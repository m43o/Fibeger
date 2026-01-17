import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/app/lib/prisma';

const MAX_CAPTION_LENGTH = 500;

// GET - Fetch feed posts from friends and own posts
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt((session.user as any).id);

    // Get all friend IDs for the current user
    const friends = await prisma.friend.findMany({
      where: {
        userId: userId,
      },
      select: {
        friendId: true,
      },
    });

    const friendIds = friends.map(f => f.friendId);

    // Fetch posts from the user and their friends
    const posts = await prisma.feedPost.findMany({
      where: {
        userId: {
          in: [userId, ...friendIds],
        },
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
        likes: {
          select: {
            userId: true,
          },
        },
        _count: {
          select: {
            likes: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(posts);
  } catch (error) {
    console.error('Failed to fetch feed posts:', error);
    return NextResponse.json({ error: 'Failed to fetch feed posts' }, { status: 500 });
  }
}

// POST - Create a new feed post
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt((session.user as any).id);
    const { caption, mediaUrl, mediaType } = await request.json();

    if (!mediaUrl || !mediaType) {
      return NextResponse.json(
        { error: 'Media URL and type are required' },
        { status: 400 }
      );
    }

    if (!['image', 'video', 'gif'].includes(mediaType)) {
      return NextResponse.json(
        { error: 'Invalid media type. Must be image, video, or gif' },
        { status: 400 }
      );
    }

    if (caption && caption.length > MAX_CAPTION_LENGTH) {
      return NextResponse.json(
        { error: `Caption must be ${MAX_CAPTION_LENGTH} characters or less` },
        { status: 400 }
      );
    }

    const post = await prisma.feedPost.create({
      data: {
        userId,
        caption: caption || null,
        mediaUrl,
        mediaType,
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
        likes: true,
        _count: {
          select: {
            likes: true,
          },
        },
      },
    });

    return NextResponse.json(post, { status: 201 });
  } catch (error) {
    console.error('Failed to create feed post:', error);
    return NextResponse.json({ error: 'Failed to create feed post' }, { status: 500 });
  }
}
