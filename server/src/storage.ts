import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env.js';

export const storageConfigured = Boolean(
  env.s3.endpoint && env.s3.accessKeyId && env.s3.secretAccessKey,
);

const client = new S3Client({
  region: env.s3.region,
  endpoint: env.s3.endpoint || undefined,
  credentials: { accessKeyId: env.s3.accessKeyId, secretAccessKey: env.s3.secretAccessKey },
  forcePathStyle: true,
  requestChecksumCalculation: 'WHEN_REQUIRED',
  responseChecksumValidation: 'WHEN_REQUIRED',
});

export async function putObject(key: string, body: Uint8Array, contentType: string) {
  await client.send(
    new PutObjectCommand({ Bucket: env.bucket, Key: key, Body: body, ContentType: contentType }),
  );
}

export async function deleteObject(key: string) {
  await client.send(new DeleteObjectCommand({ Bucket: env.bucket, Key: key }));
}

export async function deleteObjects(keys: string[]) {
  for (let i = 0; i < keys.length; i += 1000) {
    const batch = keys.slice(i, i + 1000).map((Key) => ({ Key }));
    await client.send(
      new DeleteObjectsCommand({ Bucket: env.bucket, Delete: { Objects: batch, Quiet: true } }),
    );
  }
}

export function signedGetUrl(key: string, expiresIn = 300) {
  return getSignedUrl(client, new GetObjectCommand({ Bucket: env.bucket, Key: key }), { expiresIn });
}
