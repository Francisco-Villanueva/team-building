import { useState } from 'react';
import { api, sessionStore } from '../lib/api';
import { useRoomCtx } from '../lib/context';
import { Confetti } from '../components/Confetti';

export function ClosingScreen({ onLeave }: { onLeave: () => void }) {
  const { session, run } = useRoomCtx();
  const [busy, setBusy] = useState(false);

  const cleanup = async () => {
    if (!window.confirm('This deletes the room, the votes and all uploaded images. Are you sure?')) return;
    setBusy(true);
    try {
      await api.deleteRoom(session);
      sessionStore.clear();
      onLeave();
    } catch (e: any) {
      window.alert(e.message);
      setBusy(false);
    }
  };

  return (
    <main className="screen center">
      <Confetti />
      <div className="hero">
        <div className="globe" aria-hidden>
          🎉
        </div>
        <h1>We discovered something new!</h1>
        <p className="lead">Thanks for sharing a little piece of yourselves with the team.</p>
      </div>

      {session.isHost ? (
        <section className="card hostpanel stack">
          <span className="badge">Host panel</span>
          <button className="btn" onClick={() => run(api.host(session, 'restart'))} disabled={busy}>
            🔄 Play again
          </button>
          <button className="btn danger" onClick={cleanup} disabled={busy}>
            🗑 Close room and delete images
          </button>
          <p className="muted small">Closing the room deletes the votes, participants and images.</p>
        </section>
      ) : (
        <>
          <p className="muted">Wait for the host to close the room or start another round.</p>
          <button className="btn ghost" onClick={onLeave}>
            Leave
          </button>
        </>
      )}
    </main>
  );
}
