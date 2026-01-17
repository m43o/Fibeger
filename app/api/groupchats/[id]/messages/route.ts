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
    const groupChatId = parseInt(id);

    // Check if user is member of this group
    const isMember = await prisma.groupChatMember.findUnique({
      where: {
        groupChatId_userId: {
          groupChatId,
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
        groupChatId,
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
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error("Get group messages error:", error);
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
    console.log('POST /api/groupchats/[id]/messages - Starting');
    const session = await getServerSession(authOptions);
    console.log('Session:', session?.user?.id ? 'Valid' : 'Invalid');

    if (!session?.user?.id) {
      console.log('Unauthorized: No session user ID');
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { content } = body;
    console.log('Request data - groupId:', id, 'content length:', content?.length);

    if (!content || content.trim().length === 0) {
      console.log('Error: Empty message content');
      return NextResponse.json(
        { error: "Message content is required" },
        { status: 400 }
      );
    }

    const userId = parseInt(session.user.id);
    const groupChatId = parseInt(id);
    console.log('Parsed IDs - userId:', userId, 'groupChatId:', groupChatId);

    // Check if user is member of this group
    const isMember = await prisma.groupChatMember.findUnique({
      where: {
        groupChatId_userId: {
          groupChatId,
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

    // Create message
    console.log('Creating message...');
    const message = await prisma.message.create({
      data: {
        content,
        senderId: userId,
        groupChatId,
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
      },
    });
    console.log('Message created successfully, id:', message.id);

    // Update group chat's updatedAt and get group info
    const groupChat = await prisma.groupChat.update({
      where: { id: groupChatId },
      data: { updatedAt: new Date() },
      select: { name: true },
    });

    // Get all group members except sender
    const members = await prisma.groupChatMember.findMany({
      where: {
        groupChatId,
        userId: { not: userId },
      },
      select: { userId: true },
    });

    // Create notifications for other members
    const senderName = message.sender.nickname || message.sender.username;
    const notificationPromises = members.map((member) =>
      prisma.notification.create({
        data: {
          userId: member.userId,
          type: "message",
          title: `New Message in ${groupChat.name}`,
          message: `${senderName}: ${content.substring(0, 50)}${content.length > 50 ? "..." : ""}`,
          link: `/groups?groupchat=${groupChatId}`,
        },
      })
    );

    const notifications = await Promise.all(notificationPromises);
    console.log('Notifications created, returning response');

    // Emit real-time events to all group members
    // Send message event to other members
    members.forEach((member) => {
      eventManager.emit(member.userId, 'message', {
        groupChatId,
        message,
      });
    });

    // Send notification events
    notifications.forEach((notification) => {
      eventManager.emit(notification.userId, 'notification', notification);
    });

    // Emit group update to all members (including sender) for sidebar refresh
    const allMembers = await prisma.groupChatMember.findMany({
      where: { groupChatId },
      select: { userId: true },
    });
    allMembers.forEach((member) => {
      eventManager.emit(member.userId, 'group_update', {
        groupChatId,
        lastMessage: message,
      });
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error("Create group message error:", error);
    console.error("Error details:", error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
