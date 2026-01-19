import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/app/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { uploadToS3, s3Enabled } from '@/app/lib/storage';
import crypto from "crypto";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

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

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("banner") as File;

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

    // Validate file size (10MB limit for banners)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File size must be less than 10MB" },
        { status: 400 }
      );
    }

    // Calculate file hash for deduplication
    const fileHash = await calculateFileHash(file);

    // Check if file with this hash already exists
    const existingFile = await prisma.fileBlob.findUnique({
      where: { hash: fileHash },
    });

    let bannerUrl: string;

    if (existingFile) {
      // File already exists, use existing URL
      bannerUrl = existingFile.url;
      console.log(`Banner deduplication: Reusing existing file ${fileHash}`);
    } else {
      // File doesn't exist, upload it
      const timestamp = Date.now();
      const userId = session.user.id;
      const ext = file.name.split(".").pop() || "jpg";
      const filename = `banners/${userId}-${timestamp}.${ext}`;

      // Check if S3/MinIO is configured
      const useS3 = s3Enabled();

      if (useS3) {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const url = await uploadToS3(filename, buffer, file.type);

        bannerUrl = url;

        // Store file metadata in database
        await prisma.fileBlob.create({
          data: {
            hash: fileHash,
            url: url,
            contentType: file.type,
            size: file.size,
            uploadedBy: parseInt(session.user.id),
          },
        });

        console.log(`Banner uploaded to S3/MinIO: ${fileHash} -> ${url}`);
      } else {
        // Use local file storage
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'banners');
        
        // Ensure directory exists
        await mkdir(uploadsDir, { recursive: true });

        // Save file locally
        const localFilename = `${userId}-${timestamp}.${ext}`;
        const filePath = path.join(uploadsDir, localFilename);
        
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        await writeFile(filePath, buffer);

        // Create public URL
        bannerUrl = `/uploads/banners/${localFilename}`;

        // Store file metadata in database
        await prisma.fileBlob.create({
          data: {
            hash: fileHash,
            url: bannerUrl,
            contentType: file.type,
            size: file.size,
            uploadedBy: parseInt(session.user.id),
          },
        });

        console.log(`Banner uploaded locally: ${fileHash} -> ${bannerUrl}`);
      }
    }

    // Update database
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(session.user.id) },
      data: { banner: bannerUrl },
      select: {
        id: true,
        username: true,
        nickname: true,
        bio: true,
        avatar: true,
        banner: true,
        country: true,
        city: true,
        pronouns: true,
        birthday: true,
        website: true,
        socialLinks: true,
        status: true,
        themeColor: true,
        interests: true,
        lastUsernameChange: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Banner upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Note: We don't delete the file from Vercel Blob or local storage
    // because of deduplication - other users might be using the same file
    // The file will remain in storage but won't be referenced by this user

    // Update database to remove banner reference
    const updatedUser = await prisma.user.update({
      where: { id: parseInt(session.user.id) },
      data: { banner: null },
      select: {
        id: true,
        username: true,
        nickname: true,
        bio: true,
        avatar: true,
        banner: true,
        country: true,
        city: true,
        pronouns: true,
        birthday: true,
        website: true,
        socialLinks: true,
        status: true,
        themeColor: true,
        interests: true,
        lastUsernameChange: true,
      },
    });

    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error("Banner delete error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
