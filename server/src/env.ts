const required = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var ${name}`);
  return v;
};

export const env = {
  databaseUrl: required('DATABASE_URL'),
  port: Number(process.env.PORT ?? 8787),
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  realtimeSecret: process.env.NEON_REALTIME_SECRET || '',
  bucket: process.env.S3_BUCKET || 'team-building-uploads',
  s3: {
    endpoint: process.env.AWS_ENDPOINT_URL_S3 || '',
    region: process.env.AWS_REGION || 'us-east-2',
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
};

// Generous cap (phone photos are often 5-12 MB); it only guards the server memory.
export const MAX_IMAGE_BYTES = 25 * 1024 * 1024;
