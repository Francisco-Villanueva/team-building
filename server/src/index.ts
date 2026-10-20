import { serve } from '@hono/node-server';
import app from './app.js';
import { env } from './env.js';
import { realtimeEnabled } from './live.js';
import { storageConfigured } from './storage.js';

serve({ fetch: app.fetch, port: env.port }, (info) => {
  console.log(
    `API listening on :${info.port} (realtime sealing: ${realtimeEnabled ? 'on' : 'off'}, storage: ${storageConfigured ? 'on' : 'off'})`,
  );
});
