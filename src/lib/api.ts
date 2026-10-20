import type { ImageCategory, RawSnapshot, Session } from '../types/game';

const BASE = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}, session?: Session | null): Promise<T> {
  const headers = new Headers(init.headers);
  if (session) headers.set('Authorization', `Bearer ${session.token}`);
  if (init.body && typeof init.body === 'string') headers.set('Content-Type', 'application/json');
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "We couldn't reach the server.");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Something went wrong.');
  return data as T;
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });
const room = (s: Session) => `/api/rooms/${s.roomId}`;

export type Snapshot = RawSnapshot & { serverTime: number };

export const api = {
  createRoom: (displayName: string) =>
    request<Session>('/api/rooms', post({ displayName })),
  join: (joinCode: string, displayName: string) =>
    request<Session>('/api/join', post({ joinCode, displayName })),
  state: (s: Session) => request<Snapshot>(`${room(s)}/state`, {}, s),
  live: (s: Session) =>
    request<{ enabled: boolean; queries: Record<string, any> | null }>(`${room(s)}/live`, { method: 'POST' }, s),
  heartbeat: (s: Session) => request<{ ok: true }>(`${room(s)}/heartbeat`, { method: 'POST' }, s),
  vote: (s: Session, questionId: string, optionIndex: number) =>
    request<Snapshot>(`${room(s)}/vote`, post({ questionId, optionIndex }), s),
  guess: (s: Session, imageId: string, participantId: string) =>
    request<Snapshot>(`${room(s)}/guess`, post({ imageId, participantId }), s),
  host: (s: Session, action: string, extra: Record<string, unknown> = {}) =>
    request<Snapshot>(`${room(s)}/host`, post({ action, ...extra }), s),
  saveTalent: (s: Session, text: string) =>
    request<Snapshot>(`${room(s)}/talent`, { method: 'PUT', body: JSON.stringify({ text }) }, s),
  deleteTalent: (s: Session) => request<Snapshot>(`${room(s)}/talent`, { method: 'DELETE' }, s),
  deleteImage: (s: Session, category: ImageCategory) =>
    request<Snapshot>(`${room(s)}/images/${category}`, { method: 'DELETE' }, s),
  imageUrl: (s: Session, imageId: string) =>
    request<{ url: string; expiresAt: number }>(`${room(s)}/images/${imageId}/url`, {}, s),
  deleteRoom: (s: Session) => request<{ ok: true }>(room(s), { method: 'DELETE' }, s),

  /** Multipart upload with progress (fetch cannot report upload progress). */
  uploadImage(
    s: Session,
    category: ImageCategory,
    file: File,
    caption: string,
    onProgress: (pct: number) => void,
  ): Promise<Snapshot> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', `${BASE}${room(s)}/images/${category}`);
      xhr.setRequestHeader('Authorization', `Bearer ${s.token}`);
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onerror = () => reject(new ApiError(0, "We couldn't upload the image. Check your connection."));
      xhr.onload = () => {
        let data: any = {};
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          /* ignore */
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new ApiError(xhr.status, data.error ?? "We couldn't upload the image."));
      };
      const form = new FormData();
      form.append('file', file);
      form.append('caption', caption);
      xhr.send(form);
    });
  },
};

const KEY = 'tb-session';
export const sessionStore = {
  load(): Session | null {
    try {
      const raw = localStorage.getItem(KEY);
      return raw ? (JSON.parse(raw) as Session) : null;
    } catch {
      return null;
    }
  },
  save(s: Session) {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {
      /* private mode: session lives only in memory */
    }
  },
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  },
};
