import { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import type { Session } from '../types/game';

const cache = new Map<string, { url: string; expiresAt: number }>();

/** Fetches a short-lived signed URL for an image and refreshes it when it expires or fails. */
export function useImageUrl(session: Session, imageId: string | null, enabled = true) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!imageId || !enabled) return;
    let cancelled = false;
    const hit = cache.get(imageId);
    if (hit && hit.expiresAt - Date.now() > 30_000 && nonce === 0) {
      setUrl(hit.url);
      setFailed(false);
      return;
    }
    setFailed(false);
    api
      .imageUrl(session, imageId)
      .then((r) => {
        cache.set(imageId, r);
        if (!cancelled) setUrl(r.url);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [session, imageId, enabled, nonce]);

  /** Call from <img onError>: retry once with a fresh URL, then give up. */
  const onError = useCallback(() => {
    if (nonce < 1 && imageId) {
      cache.delete(imageId);
      setNonce((n) => n + 1);
    } else setFailed(true);
  }, [nonce, imageId]);

  return { url, failed, onError };
}
