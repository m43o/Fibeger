import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/app/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ username: string }> }
) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { username } = await params;

    // Find the user by username
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        nickname: true,
        bio: true,
        avatar: true,
        banner: true,
        createdAt: true,
        country: true,
        city: true,
        pronouns: true,
        birthday: true,
        website: true,
        socialLinks: true,
        status: true,
        themeColor: true,
        interests: true,
        personalityBadge: true,
        // Don't include email or lastUsernameChange for other users
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if the requesting user is friends with this user
    const currentUserId = parseInt(session.user.id);
    
    const friendship = await prisma.friend.findFirst({
      where: {
        OR: [
          { userId: currentUserId, friendId: user.id },
          { userId: user.id, friendId: currentUserId },
        ],
      },
    });

    return NextResponse.json({
      ...user,
      isFriend: !!friendship,
      isOwnProfile: currentUserId === user.id,
    });
  } catch (error) {
    console.error("Profile GET error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
