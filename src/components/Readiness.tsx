import { useRoomCtx } from '../lib/context';
import { IMAGE_PROMPTS, TALENT_PROMPT } from '../data/questions';
import type { Topic } from '../types/game';

const ITEMS: { topic: Topic; label: string; emoji: string }[] = [
  { topic: 'travel_destination', label: 'Place', emoji: IMAGE_PROMPTS.travel_destination.emoji },
  { topic: 'meaningful_object', label: 'Object', emoji: IMAGE_PROMPTS.meaningful_object.emoji },
  { topic: 'talent', label: 'Talent', emoji: TALENT_PROMPT.emoji },
];

/** How many people already submitted each item. Only counts: authorship stays secret. */
export function useReadiness() {
  const { state } = useRoomCtx();
  const total = state.participants.length;
  const rows = ITEMS.map((it) => {
    const done = state.images.filter((i) => i.category === it.topic).length;
    return { ...it, done, total, complete: total > 0 && done >= total };
  });
  const mineMissing = ITEMS.filter((it) => !state.images.some((i) => i.mine && i.category === it.topic));
  return { rows, allReady: rows.every((r) => r.complete), mineMissing };
}

export function Readiness() {
  const { rows, allReady, mineMissing } = useReadiness();
  return (
    <div className={`readiness ${allReady ? 'ready' : ''}`} role="status">
      <strong>{allReady ? '✅ Everyone is ready!' : '⏳ Waiting for everyone to upload'}</strong>
      <ul>
        {rows.map((r) => (
          <li key={r.topic} className={r.complete ? 'complete' : ''}>
            <span>
              {r.emoji} {r.label}
            </span>
            <span className="meter" aria-hidden>
              <i style={{ width: `${r.total ? (r.done / r.total) * 100 : 0}%` }} />
            </span>
            <span className="count">
              {r.done}/{r.total}
            </span>
          </li>
        ))}
      </ul>
      {mineMissing.length > 0 && (
        <p className="small mine-missing">
          You still need: {mineMissing.map((m) => `${m.emoji} ${m.label.toLowerCase()}`).join(', ')}
        </p>
      )}
    </div>
  );
}
