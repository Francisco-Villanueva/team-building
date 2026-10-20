import { useState } from 'react';
import { api } from '../lib/api';
import { useRoomCtx } from '../lib/context';
import { TALENT_PROMPT } from '../data/questions';
import type { RoomImage } from '../types/game';

const MAX = 200;

export function TalentCard({ existing }: { existing?: RoomImage }) {
  const { session, run } = useRoomCtx();
  const [text, setText] = useState(existing?.caption ?? '');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dirty = text.trim() !== (existing?.caption ?? '');

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const ok = await run(api.saveTalent(session, text));
      setSaved(ok);
      if (!ok) setError("We couldn't save your text. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setSaved(false);
    await run(api.deleteTalent(session));
    setText('');
    setBusy(false);
  };

  return (
    <section className={`card upload ${existing ? 'done' : ''}`}>
      <h3>
        <span aria-hidden>{TALENT_PROMPT.emoji}</span> {TALENT_PROMPT.title}
      </h3>
      <p className="muted">{TALENT_PROMPT.prompt}</p>
      <label className="field">
        <span>Write it here</span>
        <textarea
          value={text}
          maxLength={MAX}
          rows={3}
          placeholder={TALENT_PROMPT.placeholder}
          onChange={(e) => {
            setText(e.target.value);
            setSaved(false);
          }}
          disabled={busy}
        />
        <small className="muted">
          {text.length}/{MAX}
        </small>
      </label>
      {error && (
        <p className="err" role="alert">
          {error}
        </p>
      )}
      {saved && !error && <p className="ok">✓ Talent saved!</p>}
      <div className="row">
        <button className="btn primary" onClick={save} disabled={busy || !text.trim() || !dirty}>
          {existing ? 'Update' : 'Save'}
        </button>
        {existing && (
          <button className="btn ghost" onClick={remove} disabled={busy}>
            Remove
          </button>
        )}
      </div>
    </section>
  );
}
