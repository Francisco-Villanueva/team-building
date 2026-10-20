import { useState } from 'react';
import { api } from '../lib/api';
import { useRoomCtx } from '../lib/context';
import { ParticipantList } from '../components/ParticipantList';
import { ImageUploadCard } from '../components/ImageUploadCard';
import { TalentCard } from '../components/TalentCard';
import { Readiness, useReadiness } from '../components/Readiness';
import { IMAGE_CATEGORY_LIST } from '../data/questions';

export function LobbyScreen() {
  const { session, state, run } = useRoomCtx();
  const { room, participants, images } = state;
  const me = participants.find((p) => p.id === session.participantId);
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}/?code=${room.joinCode}`;
  const { allReady } = useReadiness();

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy this link:', link);
    }
  };

  const start = () => {
    if (!allReady && !window.confirm('Some participants have not uploaded everything yet. Start anyway?')) return;
    run(api.host(session, 'start', { expectedVersion: room.stateVersion }));
  };

  return (
    <main className="screen">
      <header className="titlebar">
        <h1>Let's get to know each other!</h1>
        <p className="muted">
          Hi, <strong>{me?.name}</strong> 👋{' '}
          {session.isHost ? "You're the host of this room." : 'Wait for the host to start the activity.'}
        </p>
      </header>

      <div className="layout">
        <div className="col">
          {session.isHost && (
            <section className="card hostpanel">
              <span className="badge">Host panel</span>
              <p className="muted">Share this code or link with the team:</p>
              <div className="bigcode" aria-label="Room code">
                {room.joinCode}
              </div>
              <div className="row">
                <input readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Join link" />
                <button className="btn" onClick={copy}>
                  {copied ? '✓ Copied' : 'Copy link'}
                </button>
              </div>
              <p />
              <button className="btn primary big full" onClick={start}>
                🚀 Start activity
              </button>
              <p className="muted small center-text">
                {allReady ? 'Everyone is ready. You can start!' : 'Wait for everyone to upload before starting.'}
              </p>
            </section>
          )}

          <section className="card">
            <Readiness />
          </section>

          <section className="card">
            <h2>Participants ({participants.length})</h2>
            <ParticipantList participants={participants} room={room} meId={session.participantId} />
          </section>
        </div>

        <div className="col">
          <section className="card note">
            <h2>Add your own</h2>
            <p className="muted">
              Each topic is shown anonymously and the team guesses who it belongs to. Avoid photos with your face or
              your name. We need a place photo, an object photo and your talent!
            </p>
          </section>
          {IMAGE_CATEGORY_LIST.map((c) => (
            <ImageUploadCard key={c} category={c} existing={images.find((i) => i.mine && i.category === c)} />
          ))}
          <TalentCard existing={images.find((i) => i.mine && i.category === 'talent')} />
        </div>
      </div>
    </main>
  );
}
