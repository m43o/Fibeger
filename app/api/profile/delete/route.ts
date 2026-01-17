import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/app/lib/prisma';
import fs from 'fs';
import path from 'path';

export async function DELETE() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = parseInt(session.user.id);

    // Fetch user data before deletion to clean up files
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        avatar: true,
        messages: {
          select: {
            attachments: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Clean up user's avatar file
    if (user.avatar) {
      const avatarPath = path.join(process.cwd(), 'public', user.avatar);
      try {
        if (fs.existsSync(avatarPath)) {
          fs.unlinkSync(avatarPath);
        }
      } catch (error) {
        console.error('Error deleting avatar file:', error);
        // Continue with deletion even if file cleanup fails
      }
    }

    // Clean up message attachments
    for (const message of user.messages) {
      if (message.attachments) {
        try {
          const attachments = JSON.parse(message.attachments);
          if (Array.isArray(attachments)) {
            for (const attachment of attachments) {
              const attachmentPath = path.join(process.cwd(), 'public', attachment);
              try {
                if (fs.existsSync(attachmentPath)) {
                  fs.unlinkSync(attachmentPath);
                }
              } catch (error) {
                console.error('Error deleting attachment file:', error);
              }
            }
          }
        } catch (error) {
          console.error('Error parsing attachments:', error);
        }
      }
    }

    // Delete the user (cascade delete will handle all related records)
    await prisma.user.delete({
      where: { id: userId },
    });

    return NextResponse.json({ 
      success: true,
      message: 'Account deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting account:', error);
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}
