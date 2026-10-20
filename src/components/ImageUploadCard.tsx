import { useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { useImageUrl } from '../lib/useImageUrl';
import { useRoomCtx } from '../lib/context';
import { IMAGE_PROMPTS } from '../data/questions';
import type { ImageCategory, RoomImage } from '../types/game';

const MAX = 25 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function ImageUploadCard({ category, existing }: { category: ImageCategory; existing?: RoomImage }) {
  const { session, run } = useRoomCtx();
  const meta = IMAGE_PROMPTS[category];
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState(existing?.caption ?? '');
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const remote = useImageUrl(session, existing?.id ?? null, !file);

  useEffect(() => {
    if (!file) return setPreview(null);
    const u = URL.createObjectURL(file);
    setPreview(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);

  const pick = (f: File | undefined) => {
    setError(null);
    setSaved(false);
    if (!f) return;
    if (!TYPES.includes(f.type)) return setError('Please use a JPEG, PNG or WebP image.');
    if (f.size > MAX) return setError('That image is over 25 MB. Please pick a smaller one.');
    setFile(f);
  };

  const upload = async () => {
    if (!file) return;
    setError(null);
    setProgress(0);
    try {
      const snap = await api.uploadImage(session, category, file, caption, setProgress);
      await run(Promise.resolve(snap));
      setFile(null);
      setSaved(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setProgress(null);
    }
  };

  const remove = async () => {
    setError(null);
    setSaved(false);
    if (file) setFile(null);
    else if (existing) await run(api.deleteImage(session, category));
    if (input.current) input.current.value = '';
  };

  const shown = preview ?? remote.url;
  const busy = progress !== null;

  return (
    <section className={`card upload ${existing ? 'done' : ''}`}>
      <h3>
        <span aria-hidden>{meta.emoji}</span> {meta.title}
      </h3>
      <p className="muted">{meta.prompt}</p>

      <div className="drop" onClick={() => !busy && input.current?.click()}>
        {shown && !(remote.failed && !file) ? (
          <img src={shown} alt="Preview" onError={file ? undefined : remote.onError} />
        ) : existing && remote.failed ? (
          <span className="muted">We couldn't load the image</span>
        ) : (
          <span className="muted">📷 Tap to choose a photo</span>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={(e) => pick(e.target.files?.[0])}
      />

      <label className="field">
        <span>{meta.caption}</span>
        <input
          type="text"
          maxLength={200}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Tell us why"
          disabled={busy}
        />
      </label>

      {busy && (
        <div className="progress" role="progressbar" aria-valuenow={progress ?? 0}>
          <div style={{ width: `${progress}%` }} />
        </div>
      )}
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      {saved && !error && <p className="ok">✓ Image saved!</p>}

      <div className="row">
        {file ? (
          <button className="btn primary" onClick={upload} disabled={busy}>
            {busy ? `Uploading ${progress}%…` : existing ? 'Replace image' : 'Upload image'}
          </button>
        ) : (
          <button className="btn" onClick={() => input.current?.click()}>
            {existing ? 'Change photo' : 'Choose photo'}
          </button>
        )}
        {(file || existing) && (
          <button className="btn ghost" onClick={remove} disabled={busy}>
            {file ? 'Discard' : 'Remove'}
          </button>
        )}
      </div>
    </section>
  );
}
