import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/app/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { eventManager } from "@/app/lib/events";

// Fuzzy search algorithm
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("query");

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: "Search query is required" },
        { status: 400 }
      );
    }

    const userId = parseInt(session.user.id);

    // Search for users by username
    const users = await prisma.user.findMany({
      where: {
        NOT: {
          id: userId,
        },
      },
      select: {
        id: true,
        username: true,
        nickname: true,
        avatar: true,
      },
    });

    // Filter and sort by fuzzy match
    const matches = users
      .map((user) => ({
        ...user,
        distance: levenshteinDistance(query.toLowerCase(), user.username.toLowerCase()),
      }))
      .filter((user) => user.distance <= Math.max(3, Math.ceil(query.length * 0.3)))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 10) // Return top 10 matches
      .map(({ distance, ...user }) => user);

    return NextResponse.json(matches);
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { receiverUsername } = body;

    if (!receiverUsername) {
      return NextResponse.json(
        { error: "Receiver username is required" },
        { status: 400 }
      );
    }

    const senderId = parseInt(session.user.id);

    // Get receiver
    const receiver = await prisma.user.findUnique({
      where: { username: receiverUsername },
    });

    if (!receiver) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    if (receiver.id === senderId) {
      return NextResponse.json(
        { error: "Cannot send friend request to yourself" },
        { status: 400 }
      );
    }

    // Check if already friends
    const existingFriend = await prisma.friend.findUnique({
      where: {
        userId_friendId: {
          userId: senderId,
          friendId: receiver.id,
        },
      },
    });

    if (existingFriend) {
      return NextResponse.json(
        { error: "Already friends with this user" },
        { status: 400 }
      );
    }

    // Check for existing friend request
    const existingRequest = await prisma.friendRequest.findUnique({
      where: {
        senderId_receiverId: {
          senderId,
          receiverId: receiver.id,
        },
      },
    });

    if (existingRequest) {
      return NextResponse.json(
        { error: "Friend request already sent" },
        { status: 400 }
      );
    }

    // Get sender info
    const sender = await prisma.user.findUnique({
      where: { id: senderId },
      select: { username: true, nickname: true },
    });

    // Create friend request
    const friendRequest = await prisma.friendRequest.create({
      data: {
        senderId,
        receiverId: receiver.id,
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

    // Create notification for receiver
    const notification = await prisma.notification.create({
      data: {
        userId: receiver.id,
        type: "friend_request",
        title: "New Friend Request",
        message: `${sender?.nickname || sender?.username} sent you a friend request`,
        link: "/friends",
      },
    });

    // Emit real-time notification event
    eventManager.emit(receiver.id, 'notification', notification);

    return NextResponse.json(friendRequest);
  } catch (error) {
    console.error("Friend request error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
