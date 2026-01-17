import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// GET - Fetch all feed posts (public for all users)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const posts = await prisma.feedPost.findMany({
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
