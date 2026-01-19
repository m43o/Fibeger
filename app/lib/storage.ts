import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

function s3Client() {
  if (!process.env.S3_ENDPOINT) return null;

  return new S3Client({
    region: process.env.S3_REGION || 'us-east-1',
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    },
    tls: (process.env.S3_USE_TLS || 'true') === 'true',
  });
}

export async function uploadToS3(filename: string, data: Buffer, contentType: string) {
  const client = s3Client();
  if (!client) throw new Error('S3 endpoint not configured');

  const bucket = process.env.S3_BUCKET;
  if (!bucket) throw new Error('S3_BUCKET not set');

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: filename,
      Body: data,
      ContentType: contentType,
      ACL: 'public-read',
    })
  );

  // Construct public URL. Allow override via S3_PUBLIC_URL for custom domains.
  if (process.env.S3_PUBLIC_URL) {
    return `${process.env.S3_PUBLIC_URL.replace(/\/$/, '')}/${filename}`;
  }

  const endpoint = process.env.S3_ENDPOINT.replace(/\/$/, '');
  return `${endpoint}/${bucket}/${filename}`;
}

export function s3Enabled() {
  return !!process.env.S3_ENDPOINT && !!process.env.S3_BUCKET;
}
