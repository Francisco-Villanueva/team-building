import { useState } from 'react';
import { api, sessionStore } from '../lib/api';
import type { Session } from '../types/game';

export function HomeScreen({ initialCode, onSession }: { initialCode: string; onSession: (s: Session) => void }) {
  const [mode, setMode] = useState<'home' | 'create' | 'join'>(initialCode ? 'join' : 'home');
  const [name, setName] = useState('');
  const [code, setCode] = useState(initialCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = mode === 'create' ? await api.createRoom(name) : await api.join(code, name);
      sessionStore.save(s);
      history.replaceState(null, '', location.pathname);
      onSession(s);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="screen center">
      <div className="hero">
        <div className="globe" aria-hidden>
          🌍
        </div>
        <h1>
          Let's get to know
          <br />
          each other!
        </h1>
        <p className="lead">A quick 15-minute game to discover something new about your teammates.</p>
      </div>

      {mode === 'home' ? (
        <div className="stack">
          <button className="btn primary big" onClick={() => setMode('create')}>
            ✨ Create a room
          </button>
          <button className="btn big" onClick={() => setMode('join')}>
            🔑 Join with a code
          </button>
        </div>
      ) : (
        <form className="card stack" onSubmit={submit}>
          <h2>{mode === 'create' ? 'Create your room' : 'Join the room'}</h2>
          {mode === 'join' && (
            <label className="field">
              <span>Room code</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={8}
                autoCapitalize="characters"
                autoComplete="off"
                className="code-input"
                placeholder="ABC123"
                required
              />
            </label>
          )}
          <label className="field">
            <span>Your nickname</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={24}
              placeholder="What should we call you?"
              autoComplete="nickname"
              required
              autoFocus={mode === 'create' || Boolean(initialCode)}
            />
          </label>
          {error && (
            <p className="err" role="alert">
              {error}
            </p>
          )}
          <button className="btn primary big" disabled={busy || !name.trim()}>
            {busy ? 'One moment…' : mode === 'create' ? 'Create room' : 'Join'}
          </button>
          <button type="button" className="btn ghost" onClick={() => setMode('home')}>
            Back
          </button>
        </form>
      )}
    </main>
  );
}
