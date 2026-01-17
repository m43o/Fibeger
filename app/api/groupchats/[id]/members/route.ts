import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/app/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { eventManager } from "@/app/lib/events";

// POST - Add member to group (admin only)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await req.json();
    const { userId: newUserId } = body;

    if (!newUserId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const userId = parseInt(session.user.id);
    const groupChatId = parseInt(id);

    // Check if user is admin of this group
    const membership = await prisma.groupChatMember.findUnique({
      where: {
        groupChatId_userId: {
          groupChatId,
          userId,
        },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    if (membership.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can add members" },
        { status: 403 }
      );
    }

    // Check if user to add exists
    const userToAdd = await prisma.user.findUnique({
      where: { id: newUserId },
    });

    if (!userToAdd) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    // Check if user is already a member
    const existingMember = await prisma.groupChatMember.findUnique({
      where: {
        groupChatId_userId: {
          groupChatId,
          userId: newUserId,
        },
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: "User is already a member" },
        { status: 400 }
      );
    }

    // Add the member
    const newMember = await prisma.groupChatMember.create({
      data: {
        groupChatId,
        userId: newUserId,
        role: "member",
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            nickname: true,
            avatar: true,
          },
        },
      },
    });

    // Get group info for notification
    const groupChat = await prisma.groupChat.findUnique({
      where: { id: groupChatId },
      select: { name: true },
    });

    // Create notification for the added user
    const notification = await prisma.notification.create({
      data: {
        userId: newUserId,
        type: "group_invite",
        title: "Added to Group",
        message: `You've been added to ${groupChat?.name || "a group"}`,
        link: `/messages?group=${groupChatId}`,
      },
    });

    // Emit real-time notification event
    eventManager.emit(newUserId, 'notification', notification);

    return NextResponse.json(newMember);
  } catch (error) {
    console.error("Add member error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
