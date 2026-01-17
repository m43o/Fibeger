import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import prisma from '@/app/lib/prisma';

// POST - Like/Unlike a feed post
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt((session.user as any).id);
    const postId = parseInt(params.id);

    // Check if post exists
    const post = await prisma.feedPost.findUnique({
      where: { id: postId },
    });

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    // Check if user already liked the post
    const existingLike = await prisma.feedLike.findUnique({
      where: {
        postId_userId: {
          postId,
          userId,
        },
      },
    });

    if (existingLike) {
      // Unlike the post
      await prisma.feedLike.delete({
        where: {
          id: existingLike.id,
        },
      });

      return NextResponse.json({ liked: false, message: 'Post unliked' });
    } else {
      // Like the post
      await prisma.feedLike.create({
        data: {
          postId,
          userId,
        },
      });

      return NextResponse.json({ liked: true, message: 'Post liked' });
    }
  } catch (error) {
    console.error('Failed to like/unlike post:', error);
    return NextResponse.json({ error: 'Failed to like/unlike post' }, { status: 500 });
  }
}
