import { useCallback, useState } from 'react';
import { sessionStore, type Snapshot } from './lib/api';
import { useRoom } from './lib/realtime';
import { RoomContext } from './lib/context';
import { HomeScreen } from './screens/HomeScreen';
import { LobbyScreen } from './screens/LobbyScreen';
import { PickASideScreen } from './screens/PickASideScreen';
import { AboutMeScreen } from './screens/AboutMeScreen';
import { ClosingScreen } from './screens/ClosingScreen';
import { ConnectionStatus } from './components/ConnectionStatus';
import type { Session } from './types/game';

export default function App() {
  const [session, setSession] = useState<Session | null>(() => sessionStore.load());
  const code = new URLSearchParams(location.search).get('code')?.toUpperCase() ?? '';

  const leave = useCallback(() => {
    sessionStore.clear();
    setSession(null);
  }, []);

  if (!session) return <HomeScreen initialCode={code} onSession={setSession} />;
  return <Room key={session.roomId} session={session} onLeave={leave} />;
}

function Room({ session, onLeave }: { session: Session; onLeave: () => void }) {
  const { state, mode, applySnapshot } = useRoom(session, onLeave);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (p: Promise<Snapshot | unknown>) => {
      try {
        const snap = (await p) as Snapshot;
        if (snap && typeof snap === 'object' && 'room' in snap) applySnapshot(snap);
        setError(null);
        return true;
      } catch (e: any) {
        setError(e.message ?? 'Something went wrong.');
        setTimeout(() => setError(null), 4000);
        return false;
      }
    },
    [applySnapshot],
  );

  if (!state) {
    return (
      <main className="screen center">
        <div className="globe spin" aria-hidden>
          🌍
        </div>
        <p className="muted">Joining the room…</p>
        <ConnectionStatus mode={mode} />
      </main>
    );
  }

  return (
    <RoomContext.Provider value={{ session, state, run, error }}>
      <div className="topbar">
        <span className="room-tag">Room {state.room.joinCode}</span>
        <ConnectionStatus mode={mode} />
      </div>
      {state.room.phase === 'lobby' && <LobbyScreen />}
      {state.room.phase === 'pick_a_side' && <PickASideScreen />}
      {state.room.phase === 'about_me' && <AboutMeScreen />}
      {state.room.phase === 'finished' && <ClosingScreen onLeave={onLeave} />}
      {error && (
        <div className="toast" role="alert">
          {error}
        </div>
      )}
    </RoomContext.Provider>
  );
}
