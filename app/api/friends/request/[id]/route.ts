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

    const friendRequests = await prisma.friendRequest.findMany({
      where: {
        receiverId: userId,
        status: "pending",
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
        createdAt: "desc",
      },
    });

    return NextResponse.json(friendRequests);
  } catch (error) {
    console.error("Get friend requests error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PUT(
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
    const { action } = body; // 'accept' or 'reject'

    const requestId = parseInt(id);
    const userId = parseInt(session.user.id);

    if (!["accept", "reject"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }

    const friendRequest = await prisma.friendRequest.findUnique({
      where: { id: requestId },
    });

    if (!friendRequest) {
      return NextResponse.json(
        { error: "Friend request not found" },
        { status: 404 }
      );
    }

    if (friendRequest.receiverId !== userId) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    if (action === "accept") {
      // Get user info for notification
      const accepter = await prisma.user.findUnique({
        where: { id: userId },
        select: { username: true, nickname: true },
      });

      // Create friend relationship (bidirectional) and notification
      const [, , notification] = await Promise.all([
        prisma.friend.create({
          data: {
            userId: friendRequest.senderId,
            friendId: friendRequest.receiverId,
          },
        }),
        prisma.friend.create({
          data: {
            userId: friendRequest.receiverId,
            friendId: friendRequest.senderId,
          },
        }),
        // Create notification for sender
        prisma.notification.create({
          data: {
            userId: friendRequest.senderId,
            type: "friend_request",
            title: "Friend Request Accepted",
            message: `${accepter?.nickname || accepter?.username} accepted your friend request`,
            link: "/friends",
          },
        }),
      ]);

      // Emit real-time notification event
      eventManager.emit(friendRequest.senderId, 'notification', notification);
    }

    // Update request status
    const updated = await prisma.friendRequest.update({
      where: { id: requestId },
      data: {
        status: action === "accept" ? "accepted" : "rejected",
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Friend request action error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
