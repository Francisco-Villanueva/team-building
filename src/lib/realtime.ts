import { useCallback, useEffect, useRef, useState } from 'react';
import { createRealtimeClient, type MaterializedLiveQuerySubscription } from '@neon/realtime/client';
import { api, ApiError, type Snapshot } from './api';
import type { RawSnapshot, RoomState, Session, SyncMode } from '../types/game';

const REALTIME_URL = import.meta.env.VITE_NEON_REALTIME_URL as string | undefined;
const POLL_MS = Number(import.meta.env.VITE_POLL_MS ?? 1500);
const SAFETY_POLL_MS = 10_000; // slow poll while Realtime is live, as a safety net
const CONNECTED_WINDOW_MS = 20_000;
const KEYS = ['room', 'participants', 'votes', 'voters', 'images', 'guesses', 'reveals'] as const;

type Raw = Required<RawSnapshot>;
const empty: Raw = { room: [], participants: [], votes: [], voters: [], images: [], guesses: [], reveals: [] };

function toReveals(rows: any[]): RoomState['reveals'] {
  const out: RoomState['reveals'] = {};
  for (const r of rows) {
    const entry = (out[r.image_id] ??= { ownerId: r.owner_id, guesses: [] });
    if (r.guesser_id) entry.guesses.push({ guesserId: r.guesser_id, guessedId: r.guessed_participant_id });
  }
  return out;
}

function toState(raw: Raw): RoomState | null {
  const r = raw.room[0];
  if (!r) return null;
  const times = raw.participants.map((p) => new Date(p.last_seen_at).getTime());
  // Compare against the newest heartbeat instead of the local clock to avoid clock skew.
  const newest = Math.max(0, ...times);
  return {
    room: {
      id: r.id,
      joinCode: r.join_code,
      hostParticipantId: r.host_participant_id,
      phase: r.phase,
      currentQuestionId: r.current_question_id,
      currentPresenterId: r.current_presenter_id,
      topic: r.topic,
      topicStage: r.topic_stage,
      slideIndex: Number(r.slide_index),
      votesOpen: r.votes_open,
      resultsVisible: r.results_visible,
      stateVersion: Number(r.state_version),
    },
    participants: raw.participants.map((p, i) => ({
      id: p.id,
      name: p.display_name,
      lastSeen: times[i],
      connected: newest - times[i] < CONNECTED_WINDOW_MS,
    })),
    votes: Object.fromEntries(
      raw.votes.map((v) => [
        v.question_id,
        {
          questionId: v.question_id,
          voted: Number(v.voted),
          counts: v.count0 == null ? null : ([Number(v.count0), Number(v.count1)] as [number, number]),
        },
      ]),
    ),
    myVotes: Object.fromEntries(
      raw.votes.filter((v) => v.my_vote != null).map((v) => [v.question_id, Number(v.my_vote)]),
    ),
    voters: raw.voters.map((v) => ({
      participantId: v.participant_id,
      questionId: v.question_id,
      option: Number(v.option_index),
    })),
    images: raw.images.map((i) => ({
      id: i.id,
      category: i.category,
      caption: i.caption,
      pos: Number(i.pos),
      mine: Boolean(i.mine),
    })),
    guesses: Object.fromEntries(
      raw.guesses.map((g) => [g.image_id, { guessed: Number(g.guessed), myGuess: g.my_guess ?? null }]),
    ),
    reveals: toReveals(raw.reveals),
  };
}

let client: ReturnType<typeof createRealtimeClient> | null = null;
function getClient() {
  client ??= createRealtimeClient({ url: REALTIME_URL! });
  return client;
}

/**
 * Keeps the room state in sync. Uses Neon Realtime live queries (sealed by the backend)
 * when available and falls back to polling the same Neon-backed API otherwise.
 */
export function useRoom(session: Session, onSessionLost: () => void) {
  const [raw, setRaw] = useState<Raw>(empty);
  const [mode, setMode] = useState<SyncMode>('connecting');
  const versionRef = useRef(0);
  const lostRef = useRef(onSessionLost);
  lostRef.current = onSessionLost;

  const applySnapshot = useCallback((snap: RawSnapshot | Snapshot) => {
    const incoming = snap.room?.[0]?.state_version;
    if (incoming != null) {
      const v = Number(incoming);
      if (v < versionRef.current) return; // stale response
      versionRef.current = v;
    }
    setRaw((prev) => ({ ...prev, ...Object.fromEntries(KEYS.filter((k) => snap[k]).map((k) => [k, snap[k]])) }));
  }, []);

  const fail = useCallback((e: unknown) => {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) lostRef.current();
  }, []);

  const refresh = useCallback(async () => {
    try {
      applySnapshot(await api.state(session));
      return true;
    } catch (e) {
      fail(e);
      return false;
    }
  }, [session, applySnapshot, fail]);

  // Heartbeat (presence)
  useEffect(() => {
    const beat = () => api.heartbeat(session).catch(fail);
    beat();
    const t = setInterval(beat, 5000);
    return () => clearInterval(t);
  }, [session, fail]);

  // Synchronisation: Realtime when possible, polling otherwise.
  useEffect(() => {
    let cancelled = false;
    let pollTimer: ReturnType<typeof setTimeout> | undefined;
    let renewTimer: ReturnType<typeof setInterval> | undefined;
    let subs: MaterializedLiveQuerySubscription<any>[] = [];
    let live = false;

    const poll = async () => {
      if (cancelled) return;
      if (!document.hidden) {
        const ok = await refresh();
        if (!cancelled && !live) setMode(ok ? 'polling' : 'offline');
      }
      if (!cancelled) pollTimer = setTimeout(poll, live ? SAFETY_POLL_MS : POLL_MS);
    };
    const onVisible = () => {
      if (!document.hidden) {
        clearTimeout(pollTimer);
        poll();
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    const startRealtime = async () => {
      if (!REALTIME_URL) return;
      try {
        const { enabled, queries } = await api.live(session);
        if (cancelled || !enabled || !queries) return;
        const rt = getClient();
        const status = new Map<string, string>();
        const evaluate = () => {
          const all = KEYS.every((k) => status.get(k) === 'live');
          const broken = KEYS.some((k) => status.get(k) === 'error' || status.get(k) === 'closed');
          live = all && !broken;
          if (!cancelled) setMode(live ? 'realtime' : broken ? 'polling' : 'connecting');
          if (broken) {
            clearTimeout(pollTimer);
            poll();
          }
        };
        subs = KEYS.map((key) => {
          const sub = rt.subscribe<any>(queries[key]);
          sub.onChange((snap) => {
            status.set(key, snap.status);
            if (snap.data) applySnapshot({ [key]: snap.data as any[] });
            evaluate();
          });
          return sub;
        });
        // Sealed queries are short-lived (~60s): renew them before they expire.
        renewTimer = setInterval(async () => {
          try {
            const fresh = await api.live(session);
            if (!fresh.queries) return;
            await Promise.all(subs.map((s, i) => s.renew(fresh.queries![KEYS[i]])));
          } catch (e) {
            fail(e);
          }
        }, 30_000);
      } catch (e) {
        fail(e); // anything else: stay on polling
      }
    };

    poll();
    startRealtime();

    return () => {
      cancelled = true;
      clearTimeout(pollTimer);
      clearInterval(renewTimer);
      document.removeEventListener('visibilitychange', onVisible);
      subs.forEach((s) => s.unsubscribe());
    };
  }, [session, refresh, applySnapshot, fail]);

  return { state: toState(raw), mode, applySnapshot, refresh };
}
