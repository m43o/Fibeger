import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/app/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
// import { put } from "@vercel/blob";
import { uploadToS3, s3Enabled } from "@/app/lib/storage";
import crypto from "crypto";
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { eventManager } from "@/app/lib/events";

/**
 * Calculate SHA-256 hash of a file
 */
async function calculateFileHash(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  return hash.digest('hex');
}

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
    const groupChatId = parseInt(id);
    const userId = parseInt(session.user.id);

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
        { error: "You are not a member of this group" },
        { status: 403 }
      );
    }

    if (membership.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can change the group avatar" },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("avatar") as File;

    if (!file) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "File must be an image" },
        { status: 400 }
      );
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 5MB" },
        { status: 400 }
      );
    }

    // Calculate file hash for deduplication
    const fileHash = await calculateFileHash(file);

    // Check if file with this hash already exists
    const existingFile = await prisma.fileBlob.findUnique({
      where: { hash: fileHash },
    });

    let avatarUrl: string;

    if (existingFile) {
      // File already exists, use existing URL
      avatarUrl = existingFile.url;
      console.log(`Group avatar deduplication: Reusing existing file ${fileHash}`);
    } else {
      // File doesn't exist, upload it
      const timestamp = Date.now();
      const ext = file.name.split(".").pop() || "jpg";
      const filename = `groups/${groupChatId}-${timestamp}.${ext}`;

      // Check if S3/MinIO is configured
      const useS3Storage = s3Enabled();

      if (useS3Storage) {
        // Upload to S3/MinIO
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        avatarUrl = await uploadToS3(filename, buffer, file.type);

        // Store file metadata in database
        await prisma.fileBlob.create({
          data: {
            hash: fileHash,
            url: avatarUrl,
            contentType: file.type,
            size: file.size,
            uploadedBy: parseInt(session.user.id),
          },
        });

        console.log(`Group avatar uploaded to S3/MinIO: ${fileHash} -> ${avatarUrl}`);
      } else {
        // Use local file storage
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'groups');
        
        // Ensure directory exists
        await mkdir(uploadsDir, { recursive: true });

        // Save file locally
        const localFilename = `${groupChatId}-${timestamp}.${ext}`;
        const filePath = path.join(uploadsDir, localFilename);
        
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await writeFile(filePath, buffer);

        // Create public URL
        avatarUrl = `/uploads/groups/${localFilename}`;

        // Store file metadata in database
        await prisma.fileBlob.create({
          data: {
            hash: fileHash,
            url: avatarUrl,
            contentType: file.type,
            size: file.size,
            uploadedBy: parseInt(session.user.id),
          },
        });

        console.log(`Group avatar uploaded locally: ${fileHash} -> ${avatarUrl}`);
      }
    }

    // Get the old avatar before updating
    const oldGroup = await prisma.groupChat.findUnique({
      where: { id: groupChatId },
      select: { avatar: true },
    });

    // Update group avatar in database
    const updatedGroup = await prisma.groupChat.update({
      where: { id: groupChatId },
      data: { avatar: avatarUrl },
      include: {
        members: {
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
        },
      },
    });

    // Clean up old avatar file if it exists and is local
    if (oldGroup?.avatar && oldGroup.avatar.startsWith('/uploads/groups/')) {
      try {
        const oldFilePath = path.join(process.cwd(), 'public', oldGroup.avatar);
        await unlink(oldFilePath);
        console.log(`Cleaned up old group avatar: ${oldGroup.avatar}`);
      } catch (error) {
        // Ignore errors if file doesn't exist or can't be deleted
        console.log(`Could not delete old avatar: ${oldGroup.avatar}`);
      }
    }

    // Emit real-time event to all group members
    updatedGroup.members.forEach((member) => {
      eventManager.emit(member.user.id, 'group_updated', {
        groupChatId,
        group: updatedGroup,
      });
    });

    return NextResponse.json(updatedGroup);
  } catch (error) {
    console.error("Group avatar upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
