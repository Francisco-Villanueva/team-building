import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { env, MAX_IMAGE_BYTES } from './env.js';
import { pool, tx } from './db.js';
import { buildQueries } from './queries.js';
import { realtimeEnabled, sealQueries } from './live.js';
import { deleteObject, deleteObjects, putObject, signedGetUrl, storageConfigured } from './storage.js';
import {
  IMAGE_CATEGORIES,
  MAX_TALENT_CHARS,
  TOPICS,
  VOTE_QUESTION_IDS,
  type ImageCategory,
  type Topic,
} from './content.js';

interface Me {
  id: string;
  roomId: string;
  displayName: string;
  isHost: boolean;
}
type Env = { Variables: { me: Me } };

class HttpError extends Error {
  constructor(public status: 400 | 401 | 403 | 404 | 409 | 413 | 429 | 500 | 503, message: string) {
    super(message);
  }
}

const app = new Hono<Env>();

app.use('*', cors({ origin: env.allowedOrigins, allowHeaders: ['Authorization', 'Content-Type'], maxAge: 600 }));

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message }, err.status);
  console.error(err);
  return c.json({ error: 'Internal server error' }, 500);
});

// ---------- helpers ----------

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

const hits = new Map<string, number[]>();
function rateLimit(c: Context, bucket: string, max: number, windowMs = 60_000) {
  const ip = (c.req.header('x-forwarded-for') ?? '').split(',')[0].trim() || 'local';
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= max) throw new HttpError(429, 'Too many attempts. Please try again in a minute.');
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (!v.some((t) => now - t < windowMs)) hits.delete(k);
}

function cleanName(raw: unknown): string {
  const name = String(raw ?? '').replace(/\s+/g, ' ').trim();
  // eslint-disable-next-line no-control-regex
  if (name.length < 1 || name.length > 24 || /[\u0000-\u001f<>]/.test(name)) {
    throw new HttpError(400, 'The nickname must be between 1 and 24 characters.');
  }
  return name;
}

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function randomCode() {
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

async function json(c: Context): Promise<Record<string, unknown>> {
  try {
    const body = await c.req.json();
    return body && typeof body === 'object' ? body : {};
  } catch {
    return {};
  }
}

async function snapshot(me: Me) {
  const qs = buildQueries(me.id, me.roomId);
  const results = await Promise.all(qs.map((q) => pool.query(q.sql, q.params)));
  const out: Record<string, unknown[]> = {};
  qs.forEach((q, i) => (out[q.key] = results[i].rows));
  return { ...out, serverTime: Date.now() };
}

async function requireMember(c: Context<Env>, next: () => Promise<void>) {
  const auth = c.req.header('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!token) throw new HttpError(401, 'Invalid session.');
  const { rows } = await pool.query(
    `SELECT p.id, p.room_id, p.display_name, (r.host_participant_id = p.id) AS is_host
     FROM participants p JOIN rooms r ON r.id = p.room_id
     WHERE p.session_token_hash = $1`,
    [sha256(token)],
  );
  if (!rows[0]) throw new HttpError(401, 'Invalid session or the room was closed.');
  const me: Me = {
    id: rows[0].id,
    roomId: rows[0].room_id,
    displayName: rows[0].display_name,
    isHost: rows[0].is_host,
  };
  // The room id in the URL is never trusted by itself.
  if (c.req.param('roomId') !== me.roomId) throw new HttpError(403, "You don't belong to this room.");
  c.set('me', me);
  await next();
}

const requireHost = async (c: Context<Env>, next: () => Promise<void>) => {
  if (!c.get('me').isHost) throw new HttpError(403, 'Only the host can do this.');
  await next();
};

// ---------- sessions ----------

app.get('/api/health', (c) =>
  c.json({ ok: true, realtime: realtimeEnabled, storage: storageConfigured }),
);

app.post('/api/rooms', async (c) => {
  rateLimit(c, 'create', 10);
  const body = await json(c);
  const name = cleanName(body.displayName);
  const token = randomBytes(32).toString('base64url');

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const out = await tx(async (db) => {
        const room = await db.query(`INSERT INTO rooms (join_code) VALUES ($1) RETURNING id, join_code`, [
          randomCode(),
        ]);
        const p = await db.query(
          `INSERT INTO participants (room_id, display_name, session_token_hash)
           VALUES ($1, $2, $3) RETURNING id`,
          [room.rows[0].id, name, sha256(token)],
        );
        await db.query(`UPDATE rooms SET host_participant_id = $1 WHERE id = $2`, [
          p.rows[0].id,
          room.rows[0].id,
        ]);
        return { roomId: room.rows[0].id, joinCode: room.rows[0].join_code, participantId: p.rows[0].id };
      });
      return c.json({ ...out, token, isHost: true });
    } catch (e: any) {
      if (e?.code === '23505' && attempt < 4) continue; // join_code collision
      throw e;
    }
  }
  throw new HttpError(500, "The room couldn't be created.");
});

app.post('/api/join', async (c) => {
  rateLimit(c, 'join', 20);
  const body = await json(c);
  const code = String(body.joinCode ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const name = cleanName(body.displayName);
  const room = await pool.query(`SELECT id, phase FROM rooms WHERE join_code = $1`, [code]);
  if (!room.rows[0]) throw new HttpError(404, "We couldn't find a room with that code.");
  if (room.rows[0].phase === 'finished') throw new HttpError(409, 'This activity has already finished.');
  const count = await pool.query(`SELECT count(*)::int AS n FROM participants WHERE room_id = $1`, [
    room.rows[0].id,
  ]);
  if (count.rows[0].n >= 30) throw new HttpError(409, 'The room is full.');

  const token = randomBytes(32).toString('base64url');
  try {
    const p = await pool.query(
      `INSERT INTO participants (room_id, display_name, session_token_hash)
       VALUES ($1, $2, $3) RETURNING id`,
      [room.rows[0].id, name, sha256(token)],
    );
    return c.json({ roomId: room.rows[0].id, joinCode: code, participantId: p.rows[0].id, token, isHost: false });
  } catch (e: any) {
    if (e?.code === '23505') throw new HttpError(409, 'That nickname is already taken in this room.');
    throw e;
  }
});

// ---------- room state ----------

const room = new Hono<Env>();
room.use('*', requireMember);

room.get('/state', async (c) => c.json(await snapshot(c.get('me'))));

room.post('/live', async (c) => {
  const me = c.get('me');
  const sealed = await sealQueries(me.id, me.roomId).catch((e) => {
    console.error('seal failed', e);
    return null;
  });
  return c.json({ enabled: Boolean(sealed), queries: sealed });
});

room.post('/heartbeat', async (c) => {
  const me = c.get('me');
  await pool.query(`UPDATE participants SET last_seen_at = now() WHERE id = $1`, [me.id]);
  return c.json({ ok: true });
});

// ---------- voting ----------

room.post('/vote', async (c) => {
  const me = c.get('me');
  const body = await json(c);
  const optionIndex = Number(body.optionIndex);
  if (![0, 1].includes(optionIndex)) throw new HttpError(400, 'Invalid option.');
  const questionId = String(body.questionId ?? '');
  const { rows } = await pool.query(
    `SELECT phase, current_question_id, votes_open FROM rooms WHERE id = $1`,
    [me.roomId],
  );
  const r = rows[0];
  if (r.phase !== 'pick_a_side' || r.current_question_id !== questionId) {
    throw new HttpError(409, 'That question is no longer active.');
  }
  if (!r.votes_open) throw new HttpError(409, 'Voting is closed.');
  await pool.query(
    `INSERT INTO votes (room_id, participant_id, question_id, option_index)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (room_id, participant_id, question_id)
     DO UPDATE SET option_index = EXCLUDED.option_index, updated_at = now()`,
    [me.roomId, me.id, questionId, optionIndex],
  );
  return c.json(await snapshot(me));
});

// ---------- guessing whose photo it is ----------

room.post('/guess', async (c) => {
  const me = c.get('me');
  const body = await json(c);
  const imageId = String(body.imageId ?? '');
  const guessedId = String(body.participantId ?? '');
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!uuid.test(imageId) || !uuid.test(guessedId)) throw new HttpError(400, 'Invalid data.');
  const { rows } = await pool.query(
    `SELECT r.phase, r.topic, r.topic_stage, i.category, i.participant_id AS owner_id,
            EXISTS (SELECT 1 FROM participants WHERE id = $3 AND room_id = r.id) AS guessed_ok
     FROM rooms r JOIN participant_images i ON i.room_id = r.id AND i.id = $2
     WHERE r.id = $1`,
    [me.roomId, imageId, guessedId],
  );
  const g = rows[0];
  if (!g) throw new HttpError(404, 'Image not found.');
  if (g.phase !== 'about_me' || g.topic_stage !== 'guess' || g.topic !== g.category) {
    throw new HttpError(409, 'This item is not being voted on right now.');
  }
  if (g.owner_id === me.id) throw new HttpError(409, "You can't vote on your own item.");
  if (!g.guessed_ok) throw new HttpError(400, 'Invalid participant.');
  await pool.query(
    `INSERT INTO guesses (room_id, guesser_id, image_id, guessed_participant_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (room_id, guesser_id, image_id)
     DO UPDATE SET guessed_participant_id = EXCLUDED.guessed_participant_id, updated_at = now()`,
    [me.roomId, me.id, imageId, guessedId],
  );
  return c.json(await snapshot(me));
});

// ---------- host actions ----------

/** Fields that put the room at the start of a topic. */
function topicStart(topic: Topic) {
  return {
    topic,
    topic_stage: 'guess',
    slide_index: 0,
    current_question_id: null,
    current_presenter_id: null,
  };
}

room.post('/host', requireHost, async (c) => {
  const me = c.get('me');
  const body = await json(c);
  const action = String(body.action ?? '');
  const expected = body.expectedVersion == null ? null : Number(body.expectedVersion);

  await tx(async (db) => {
    const { rows } = await db.query(`SELECT * FROM rooms WHERE id = $1 FOR UPDATE`, [me.roomId]);
    const r = rows[0];
    if (expected !== null && Number(r.state_version) !== expected) {
      throw new HttpError(409, 'The state changed. Refreshing…');
    }
    const set: Record<string, unknown> = {};
    const need = (cond: boolean, msg: string) => {
      if (!cond) throw new HttpError(409, msg);
    };

    switch (action) {
      case 'start':
        need(r.phase === 'lobby', 'The activity has already started.');
        Object.assign(set, {
          phase: 'pick_a_side',
          current_question_id: VOTE_QUESTION_IDS[0],
          votes_open: true,
          results_visible: false,
        });
        break;
      case 'set_votes_open':
        need(r.phase === 'pick_a_side' && !r.results_visible, "Voting can't be changed right now.");
        set.votes_open = Boolean(body.open);
        break;
      case 'reveal':
        need(r.phase === 'pick_a_side', 'There is no active vote.');
        Object.assign(set, { votes_open: false, results_visible: true });
        break;
      case 'next_question': {
        need(r.phase === 'pick_a_side', 'There is no active vote.');
        const idx = (VOTE_QUESTION_IDS as readonly string[]).indexOf(r.current_question_id);
        if (idx + 1 >= VOTE_QUESTION_IDS.length) {
          Object.assign(set, { phase: 'about_me', votes_open: false, results_visible: false }, topicStart(TOPICS[0]));
        } else {
          Object.assign(set, {
            current_question_id: VOTE_QUESTION_IDS[idx + 1],
            votes_open: true,
            results_visible: false,
          });
        }
        break;
      }
      case 'next':
      case 'prev':
      case 'next_topic': {
        need(r.phase === 'about_me' && r.topic, "We're not in the personal round yet.");
        const nextTopic = TOPICS[(TOPICS as readonly string[]).indexOf(r.topic) + 1];
        const goNextTopic = () => {
          if (nextTopic) Object.assign(set, topicStart(nextTopic));
          else Object.assign(set, { phase: 'finished', votes_open: false, current_presenter_id: null });
        };
        if (action === 'next_topic') {
          goNextTopic();
          break;
        }
        const { rows: cnt } = await db.query(
          `SELECT count(*)::int AS n FROM participant_images WHERE room_id = $1 AND category = $2`,
          [me.roomId, r.topic],
        );
        const n: number = cnt[0].n;
        const idx: number = r.slide_index;
        if (action === 'prev') {
          need(r.topic_stage === 'reveal' && idx > 0, 'There is no previous step.');
          set.slide_index = idx - 1;
        } else if (r.topic_stage === 'guess') {
          // Everything is on screen from the start; "next" moves on to the answers.
          if (n === 0) goNextTopic();
          else Object.assign(set, { topic_stage: 'reveal', slide_index: 0 });
        } else if (r.topic_stage === 'reveal') {
          if (idx + 1 < n) set.slide_index = idx + 1;
          else set.topic_stage = 'summary';
        } else {
          goNextTopic(); // summary
        }
        break;
      }
      case 'finish':
        Object.assign(set, { phase: 'finished', votes_open: false, current_presenter_id: null });
        break;
      case 'restart':
        await db.query(`DELETE FROM votes WHERE room_id = $1`, [me.roomId]);
        await db.query(`DELETE FROM guesses WHERE room_id = $1`, [me.roomId]);
        Object.assign(set, {
          phase: 'lobby',
          current_question_id: null,
          current_presenter_id: null,
          topic: null,
          topic_stage: null,
          slide_index: 0,
          votes_open: false,
          results_visible: false,
        });
        break;
      default:
        throw new HttpError(400, 'Unknown action.');
    }

    const cols = Object.keys(set);
    const assigns = cols.map((k, i) => `${k} = $${i + 2}`).join(', ');
    await db.query(
      `UPDATE rooms SET ${assigns}, state_version = state_version + 1, updated_at = now() WHERE id = $1`,
      [me.roomId, ...cols.map((k) => set[k])],
    );
  });

  return c.json(await snapshot(me));
});

// ---------- images ----------

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function sniffImage(b: Uint8Array): string | null {
  if (b.length > 12) {
    if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
    if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
    const tag = (o: number) => String.fromCharCode(b[o], b[o + 1], b[o + 2], b[o + 3]);
    if (tag(0) === 'RIFF' && tag(8) === 'WEBP') return 'image/webp';
  }
  return null;
}

/** Photos are frozen once the activity starts, so the anonymous order stays stable. */
async function requireLobby(roomId: string) {
  const { rows } = await pool.query(`SELECT phase FROM rooms WHERE id = $1`, [roomId]);
  if (rows[0]?.phase !== 'lobby') {
    throw new HttpError(409, 'The activity has started: uploads can no longer be changed.');
  }
}

function parseCategory(raw: string): ImageCategory {
  if (!(IMAGE_CATEGORIES as readonly string[]).includes(raw)) throw new HttpError(400, 'Invalid category.');
  return raw as ImageCategory;
}

room.put('/images/:category', async (c) => {
  const me = c.get('me');
  if (!storageConfigured) throw new HttpError(503, 'Image storage is not configured.');
  const category = parseCategory(c.req.param('category'));
  await requireLobby(me.roomId);

  const declared = Number(c.req.header('content-length') ?? 0);
  if (declared > MAX_IMAGE_BYTES + 100_000) throw new HttpError(413, `The image exceeds ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`);

  const form = await c.req.parseBody().catch(() => {
    throw new HttpError(400, 'Invalid form.');
  });
  const file = form['file'];
  if (!(file instanceof File)) throw new HttpError(400, 'The file is missing.');
  if (file.size === 0) throw new HttpError(400, 'The file is empty.');
  if (file.size > MAX_IMAGE_BYTES) throw new HttpError(413, `The image exceeds ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = sniffImage(bytes);
  if (!contentType) throw new HttpError(400, 'Unsupported format. Please use JPEG, PNG or WebP.');

  let caption: string | null = String(form['caption'] ?? '').trim();
  if (caption.length > 200) throw new HttpError(400, 'The text cannot exceed 200 characters.');
  if (!caption) caption = null;

  const key = `rooms/${me.roomId}/${randomUUID()}.${EXT[contentType]}`;
  await putObject(key, bytes, contentType);

  let oldKey: string | null = null;
  try {
    const { rows } = await pool.query(
      `WITH old AS (
         SELECT object_key FROM participant_images
         WHERE room_id = $1 AND participant_id = $2 AND category = $3
       ), up AS (
         INSERT INTO participant_images (room_id, participant_id, category, object_key, caption, content_type, file_size)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (room_id, participant_id, category) DO UPDATE
           SET object_key = EXCLUDED.object_key, caption = EXCLUDED.caption,
               content_type = EXCLUDED.content_type, file_size = EXCLUDED.file_size, created_at = now()
         RETURNING id
       )
       SELECT (SELECT object_key FROM old) AS old_key, (SELECT id FROM up) AS id`,
      [me.roomId, me.id, category, key, caption, contentType, file.size],
    );
    oldKey = rows[0].old_key;
  } catch (e) {
    await deleteObject(key).catch((err) => console.error('orphan cleanup failed', key, err));
    throw e;
  }
  if (oldKey) await deleteObject(oldKey).catch((err) => console.error('old image cleanup failed', oldKey, err));
  return c.json(await snapshot(me));
});

room.delete('/images/:category', async (c) => {
  const me = c.get('me');
  const category = parseCategory(c.req.param('category'));
  await requireLobby(me.roomId);
  const { rows } = await pool.query(
    `DELETE FROM participant_images WHERE room_id = $1 AND participant_id = $2 AND category = $3
     RETURNING object_key`,
    [me.roomId, me.id, category],
  );
  if (rows[0] && storageConfigured) {
    await deleteObject(rows[0].object_key).catch((err) => console.error('delete failed', err));
  }
  return c.json(await snapshot(me));
});

room.put('/talent', async (c) => {
  const me = c.get('me');
  await requireLobby(me.roomId);
  const body = await json(c);
  const text = String(body.text ?? '').replace(/s+/g, ' ').trim();
  if (text.length < 1) throw new HttpError(400, 'Please write your talent.');
  if (text.length > MAX_TALENT_CHARS) {
    throw new HttpError(400, `The text cannot exceed ${MAX_TALENT_CHARS} characters.`);
  }
  await pool.query(
    `INSERT INTO participant_images (room_id, participant_id, category, caption)
     VALUES ($1, $2, 'talent', $3)
     ON CONFLICT (room_id, participant_id, category) DO UPDATE SET caption = EXCLUDED.caption, created_at = now()`,
    [me.roomId, me.id, text],
  );
  return c.json(await snapshot(me));
});

room.delete('/talent', async (c) => {
  const me = c.get('me');
  await requireLobby(me.roomId);
  await pool.query(
    `DELETE FROM participant_images WHERE room_id = $1 AND participant_id = $2 AND category = 'talent'`,
    [me.roomId, me.id],
  );
  return c.json(await snapshot(me));
});

room.get('/images/:imageId/url', async (c) => {
  const me = c.get('me');
  if (!storageConfigured) throw new HttpError(503, 'Image storage is not configured.');
  const id = c.req.param('imageId');
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new HttpError(404, 'Image not found.');
  const { rows } = await pool.query(
    `SELECT i.object_key, i.participant_id, i.category, r.phase, r.topic, r.topic_stage, r.slide_index, x.pos
     FROM participant_images i
     JOIN rooms r ON r.id = i.room_id
     JOIN (
       SELECT id, row_number() OVER (PARTITION BY category ORDER BY md5(id::text))::int AS pos
       FROM participant_images WHERE room_id = $2
     ) x ON x.id = i.id
     WHERE i.id = $1 AND i.room_id = $2`,
    [id, me.roomId],
  );
  const img = rows[0];
  if (!img || !img.object_key) throw new HttpError(404, 'Image not found.');
  // Photos stay private until their turn: the owner always sees their own; everyone else only
  // gets the image currently on screen (show) or the whole topic once voting starts.
  const inTopic = img.phase === 'about_me' && img.topic === img.category;
  const allowed =
    img.participant_id === me.id ||
    (inTopic &&
      (img.topic_stage === 'guess' ||
        img.topic_stage === 'reveal' ||
        img.topic_stage === 'summary' ||
        (img.topic_stage === 'show' && img.pos <= img.slide_index + 1)));
  if (!allowed) throw new HttpError(403, 'This image is not visible yet.');
  const expiresIn = 300;
  return c.json({ url: await signedGetUrl(img.object_key, expiresIn), expiresAt: Date.now() + expiresIn * 1000 });
});

// ---------- cleanup ----------

room.delete('/', requireHost, async (c) => {
  const me = c.get('me');
  const { rows } = await pool.query(`SELECT object_key FROM participant_images WHERE room_id = $1 AND object_key IS NOT NULL`, [me.roomId]);
  if (rows.length && storageConfigured) {
    await deleteObjects(rows.map((r) => r.object_key));
  }
  await pool.query(`DELETE FROM rooms WHERE id = $1`, [me.roomId]); // cascades participants, votes, images
  return c.json({ ok: true });
});

app.route('/api/rooms/:roomId', room);

export default app;
