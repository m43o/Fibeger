import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/app/lib/prisma";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";

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

    // Get current user to delete old banner
    const currentUser = await prisma.user.findUnique({
      where: { id: parseInt(session.user.id) },
      select: { banner: true },
    });

    // Delete old banner if exists
    if (currentUser?.banner) {
      const oldPath = join(process.cwd(), "public", currentUser.banner);
      if (existsSync(oldPath)) {
        try {
          await unlink(oldPath);
        } catch (error) {
          console.error("Failed to delete old banner:", error);
        }
      }
    }

    // Read file buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create unique filename
    const timestamp = Date.now();
    const originalName = file.name.replace(/\s+/g, "-");
    const filename = `${session.user.id}-${timestamp}-${originalName}`;
    const uploadDir = join(process.cwd(), "public", "uploads", "banners");
    const filepath = join(uploadDir, filename);

    // Ensure directory exists
    try {
      const { mkdirSync } = await import("fs");
      mkdirSync(uploadDir, { recursive: true });
    } catch (dirError) {
      console.error("Error creating directory:", dirError);
      // Directory might already exist, continue
    }

    // Write file
    await writeFile(filepath, buffer);

    // Update database
    const bannerUrl = `/uploads/banners/${filename}`;
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

    // Get current user
    const currentUser = await prisma.user.findUnique({
      where: { id: parseInt(session.user.id) },
      select: { banner: true },
    });

    // Delete banner file if exists
    if (currentUser?.banner) {
      const bannerPath = join(process.cwd(), "public", currentUser.banner);
      if (existsSync(bannerPath)) {
        try {
          await unlink(bannerPath);
        } catch (error) {
          console.error("Failed to delete banner:", error);
        }
      }
    }

    // Update database
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
