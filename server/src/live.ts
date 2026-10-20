import { createRealtime, rawSql } from '@neon/realtime/server';
import { env } from './env.js';
import { buildQueries } from './queries.js';

export const realtimeEnabled = Boolean(env.realtimeSecret);

const dbName = decodeURIComponent(new URL(env.databaseUrl).pathname.replace(/^\//, ''));

const realtime = realtimeEnabled
  ? createRealtime({ secret: env.realtimeSecret, db: dbName })
  : null;

/** Seals the participant-scoped queries. The caller must have authenticated the participant. */
export async function sealQueries(participantId: string, roomId: string) {
  if (!realtime) return null;
  const out: Record<string, unknown> = {};
  for (const q of buildQueries(participantId, roomId)) {
    out[q.key] = await realtime.seal({ query: rawSql(q.sql, q.params) });
  }
  return out;
}
