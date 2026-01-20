import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

function s3Client() {
  // Removed check for S3_ENDPOINT to support standard AWS S3 (no custom endpoint needed)
  return new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    // Set endpoint only if S3_ENDPOINT is provided (for S3-compatible services like MinIO)
    ...(process.env.S3_ENDPOINT && { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true }),
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
    tls: (process.env.S3_USE_TLS || 'true') === 'true',
  });
}

export async function uploadToS3(filename: string, data: Buffer, contentType: string) {
  const client = s3Client();
  // Removed check for client being null, as it's now always created

  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET not set');

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: filename,
      Body: data,
      ContentType: contentType,
      // Removed ACL: 'public-read' as it's deprecated in AWS S3 v3.
      // For public access, configure bucket policy or use presigned URLs instead.
    })
  );

  // Construct public URL. Allow override via S3_PUBLIC_URL for custom domains. 
  if (process.env.S3_PUBLIC_URL) {
    return `${process.env.S3_PUBLIC_URL.replace(/\/$/, '')}/${bucket}/${filename}`;
  }

  // If custom endpoint, use it; else, use standard AWS S3 URL format
  if (process.env.S3_ENDPOINT) {
    const endpoint = process.env.S3_ENDPOINT.replace(/\/$/, '');
    return `${endpoint}/${bucket}/${filename}`;
  } else {
    const region = process.env.S3_REGION || 'us-east-1';
    return `https://${bucket}.s3.${region}.amazonaws.com/${filename}`;
  }
}

export function s3Enabled() {
  // Now only requires bucket; endpoint is optional
  return !!process.env.S3_BUCKET;
}
