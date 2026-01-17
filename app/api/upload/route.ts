import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { put } from '@vercel/blob';
import prisma from '@/app/lib/prisma';
import crypto from 'crypto';

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

/**
 * POST /api/upload
 * Handles file uploads (images, videos, etc.) with deduplication
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await req.formData();
    
    // Support both single file ('file') and multiple files ('files')
    let files: File[] = [];
    const singleFile = formData.get('file') as File | null;
    const multipleFiles = formData.getAll('files') as File[];
    
    if (singleFile) {
      files = [singleFile];
    } else if (multipleFiles && multipleFiles.length > 0) {
      files = multipleFiles;
    }

    if (!files || files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    const uploadedFiles = [];

    for (const file of files) {
      // Validate file type (images and videos only)
      const validTypes = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/webm',
        'video/ogg',
      ];

      if (!validTypes.includes(file.type)) {
        return NextResponse.json(
          { error: `Invalid file type: ${file.type}. Only images and videos are allowed.` },
          { status: 400 }
        );
      }

      // Validate file size (max 50MB)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (file.size > maxSize) {
        return NextResponse.json(
          { error: 'File size exceeds 50MB limit' },
          { status: 400 }
        );
      }

      // Calculate file hash for deduplication
      const fileHash = await calculateFileHash(file);

      // Check if file with this hash already exists
      const existingFile = await prisma.fileBlob.findUnique({
        where: { hash: fileHash },
      });

      let fileUrl: string;

      if (existingFile) {
        // File already exists, use existing URL
        fileUrl = existingFile.url;
        console.log(`File deduplication: Reusing existing file ${fileHash}`);
      } else {
        // File doesn't exist, upload it
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(2, 9);
        const extension = file.name.split('.').pop();
        
        // Check for folder parameter (defaults to 'messages')
        const folder = formData.get('folder') as string || 'messages';
        const filename = `${folder}/${timestamp}-${randomId}.${extension}`;

        // Upload to Vercel Blob Storage
        const blob = await put(filename, file, {
          access: 'public',
          contentType: file.type,
        });

        fileUrl = blob.url;

        // Store file metadata in database
        await prisma.fileBlob.create({
          data: {
            hash: fileHash,
            url: blob.url,
            contentType: file.type,
            size: file.size,
            uploadedBy: parseInt(session.user.id),
          },
        });

        console.log(`File uploaded: ${fileHash} -> ${blob.url}`);
      }

      uploadedFiles.push({
        url: fileUrl,
        type: file.type,
        name: file.name,
        size: file.size,
        deduplicated: !!existingFile,
      });
    }

    // Return single file format for single uploads, array for multiple
    if (uploadedFiles.length === 1) {
      return NextResponse.json({ 
        url: uploadedFiles[0].url,
        type: uploadedFiles[0].type,
        name: uploadedFiles[0].name,
        size: uploadedFiles[0].size,
        deduplicated: uploadedFiles[0].deduplicated,
      });
    }
    
    return NextResponse.json({ files: uploadedFiles });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
