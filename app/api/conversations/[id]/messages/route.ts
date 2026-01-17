import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/app/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { eventManager } from "@/app/lib/events";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const userId = parseInt(session.user.id);
    const conversationId = parseInt(id);

    // Check if user is member of this conversation
    const isMember = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });

    if (!isMember) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const messages = await prisma.message.findMany({
      where: {
        conversationId,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            nickname: true,
            avatar: true,
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                nickname: true,
                avatar: true,
              }
            }
          }
        },
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                nickname: true,
                avatar: true,
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Parse attachments from JSON strings to arrays
    const messagesWithParsedAttachments = messages.map(msg => ({
      ...msg,
      attachments: msg.attachments ? JSON.parse(msg.attachments) : null
    }));

    return NextResponse.json(messagesWithParsedAttachments);
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    console.log('POST /api/conversations/[id]/messages - Starting');
    const session = await getServerSession(authOptions);
    console.log('Session:', session?.user?.id ? 'Valid' : 'Invalid');

    if (!session?.user?.id) {
      console.log('Unauthorized: No session user ID');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { content, attachments, replyToId } = body;
    console.log('Request data - conversationId:', id, 'content length:', content?.length, 'attachments:', attachments?.length || 0);

    if ((!content || content.trim().length === 0) && (!attachments || attachments.length === 0)) {
      console.log('Error: Empty message content and no attachments');
      return NextResponse.json(
        { error: "Message content or attachments required" },
        { status: 400 }
      );
    }

    const userId = parseInt(session.user.id);
    const conversationId = parseInt(id);
    console.log('Parsed IDs - userId:', userId, 'conversationId:', conversationId);

    // Check if user is member of this conversation
    console.log('Checking membership...');
    const isMember = await prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          conversationId,
          userId,
        },
      },
    });
    console.log('Membership check result:', isMember ? 'Member' : 'Not a member');

    if (!isMember) {
      console.log('Error: User is not a member of this conversation');
      return NextResponse.json(
        { error: "Unauthorized - Not a member of this conversation" },
        { status: 403 }
      );
    }

    // Create message
    console.log('Creating message...');
    const message = await prisma.message.create({
      data: {
        content: content || '',
        attachments: attachments ? JSON.stringify(attachments) : null,
        senderId: userId,
        conversationId,
        replyToId: replyToId ? parseInt(replyToId) : null,
      },
      include: {
        sender: {
          select: {
            id: true,
            username: true,
            nickname: true,
            avatar: true,
          },
        },
        reactions: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                nickname: true,
                avatar: true,
              }
            }
          }
        },
        replyTo: {
          include: {
            sender: {
              select: {
                id: true,
                username: true,
                nickname: true,
                avatar: true,
              }
            }
          }
        }
      },
    });
    console.log('Message created successfully, id:', message.id);

    // Update conversation's updatedAt
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    });

    // Get all conversation members except sender
    const members = await prisma.conversationMember.findMany({
      where: {
        conversationId,
        userId: { not: userId },
      },
      select: { userId: true },
    });

    // Create notifications for other members
    const senderName = message.sender.nickname || message.sender.username;
    const notificationMessage = content 
      ? `${senderName}: ${content.substring(0, 50)}${content.length > 50 ? "..." : ""}`
      : `${senderName} sent ${attachments?.length || 0} attachment(s)`;
    
    const notificationPromises = members.map((member) =>
      prisma.notification.create({
        data: {
          userId: member.userId,
          type: "message",
          title: "New Message",
          message: notificationMessage,
          link: `/messages?conversation=${conversationId}`,
        },
      })
    );

    const notifications = await Promise.all(notificationPromises);
    console.log('Notifications created, returning response');

    // Parse attachments from JSON string to array for real-time events
    const messageWithParsedAttachments = {
      ...message,
      attachments: message.attachments ? JSON.parse(message.attachments) : null
    };

    // Emit real-time events to all conversation members
    // Send message event to other members
    members.forEach((member) => {
      eventManager.emit(member.userId, 'message', {
        conversationId,
        message: messageWithParsedAttachments,
      });
    });

    // Send notification events
    notifications.forEach((notification) => {
      eventManager.emit(notification.userId, 'notification', notification);
    });

    // Emit conversation update to all members (including sender) for sidebar refresh
    const allMembers = await prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    allMembers.forEach((member) => {
      eventManager.emit(member.userId, 'conversation_update', {
        conversationId,
        lastMessage: messageWithParsedAttachments,
      });
    });

    return NextResponse.json(messageWithParsedAttachments);
  } catch (error) {
    console.error("Create message error:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
