import type { Participant, Room } from '../types/game';

export function ParticipantList({
  participants,
  room,
  meId,
}: {
  participants: Participant[];
  room: Room;
  meId: string;
}) {
  return (
    <ul className="plist">
      {participants.map((p) => (
        <li key={p.id} className={p.connected ? '' : 'away'}>
          <span className={`dot ${p.connected ? 'on' : ''}`} aria-label={p.connected ? 'Connected' : 'Disconnected'} />
          <span className="pname">
            {p.name}
            {p.id === meId && <small> (you)</small>}
          </span>
          {p.id === room.hostParticipantId && <span className="badge">Host</span>}
        </li>
      ))}
    </ul>
  );
}
