import { useEffect, useState } from 'react';
import type { VoteQuestion } from '../data/questions';

/** Number that counts up smoothly. */
function CountUp({ to, ms = 1000, delay = 0 }: { to: number; ms?: number; delay?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setV(to);
    let raf = 0;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / ms));
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to, ms, delay]);
  return <>{v}</>;
}

/** Bars sorted from most to least votes; they grow from zero with a staggered, eased animation. */
export function VoteResults({
  question,
  counts,
  myVote,
  voters,
  names,
  nonVoters,
}: {
  question: VoteQuestion;
  counts: [number, number];
  myVote?: number;
  /** Who picked each option (participant ids). */
  voters: [string[], string[]];
  names: Record<string, string>;
  nonVoters: string[];
}) {
  const total = counts[0] + counts[1];
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    return () => cancelAnimationFrame(id);
  }, []);

  const rows = question.options
    .map((o, i) => ({ o, i, votes: counts[i] }))
    .sort((a, b) => b.votes - a.votes || a.i - b.i);

  return (
    <div className="results">
      {rows.map(({ o, i, votes }, rank) => {
        const pct = total ? Math.round((votes / total) * 100) : 0;
        const win = votes > counts[1 - i];
        return (
          <div key={i} className={`bar ${win ? 'win' : ''}`} style={{ animationDelay: `${rank * 180}ms` }}>
            <div className="fill" style={{ width: shown ? `${pct}%` : '0%', transitionDelay: `${rank * 180}ms` }} />
            <span className="lbl">
              {o.emoji} {o.label}
              {myVote === i && <small> · your vote</small>}
              {voters[i].length > 0 && (
                <span className="who">
                  {voters[i].map((id, k) => (
                    <span key={id} className="who-chip" style={{ animationDelay: `${rank * 180 + 600 + k * 70}ms` }}>
                      {names[id] ?? '—'}
                    </span>
                  ))}
                </span>
              )}
            </span>
            <span className="num">
              <CountUp to={votes} delay={rank * 180} />{' '}
              <small>
                (<CountUp to={pct} delay={rank * 180} />
                %)
              </small>
            </span>
          </div>
        );
      })}
      {nonVoters.length > 0 && (
        <p className="muted small">Didn't vote: {nonVoters.map((id) => names[id] ?? '—').join(', ')}</p>
      )}
    </div>
  );
}
