import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/app/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { eventManager } from "@/app/lib/events";

// DELETE - Delete a message (only by sender)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const messageId = parseInt(id);
    const userId = parseInt(session.user.id);

    // Check if message exists and get its details
    const message = await prisma.message.findUnique({
      where: { id: messageId },
      include: {
        conversation: {
          include: {
            members: { where: { userId } }
          }
        },
        groupChat: {
          include: {
            members: { where: { userId } }
          }
        }
      }
    });

    if (!message) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      );
    }

    // Check if user is the sender of the message
    if (message.senderId !== userId) {
      return NextResponse.json(
        { error: "You can only delete your own messages" },
        { status: 403 }
      );
    }

    // Delete the message (cascade will delete reactions)
    await prisma.message.delete({
      where: { id: messageId }
    });

    // Emit real-time event to all users who can see this message
    if (message.conversationId) {
      const members = await prisma.conversationMember.findMany({
        where: { conversationId: message.conversationId },
        select: { userId: true }
      });
      members.forEach(member => {
        eventManager.emit(member.userId, 'message_deleted', {
          messageId,
          conversationId: message.conversationId,
        });
      });
    } else if (message.groupChatId) {
      const members = await prisma.groupChatMember.findMany({
        where: { groupChatId: message.groupChatId },
        select: { userId: true }
      });
      members.forEach(member => {
        eventManager.emit(member.userId, 'message_deleted', {
          messageId,
          groupChatId: message.groupChatId,
        });
      });
    }

    return NextResponse.json({ message: "Message deleted successfully" });
  } catch (error) {
    console.error("Delete message error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
