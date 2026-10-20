import { api } from '../lib/api';
import { useRoomCtx } from '../lib/context';
import { PhotoView } from '../components/PhotoView';
import { TOPICS, TOPIC_PROMPTS } from '../data/questions';
import type { RoomImage, RoomState } from '../types/game';

const nameOf = (state: RoomState, id: string) => state.participants.find((p) => p.id === id)?.name ?? '—';

/** One anonymous item of a topic: a photo, or the written talent. */
function ItemView({
  item,
  size = 'large',
  children,
}: {
  item: RoomImage;
  size?: 'large' | 'small';
  children?: React.ReactNode;
}) {
  if (item.category === 'talent') {
    return (
      <figure className={`talent-card ${size}`}>
        <blockquote>“{item.caption}”</blockquote>
        {children}
      </figure>
    );
  }
  return (
    <PhotoView image={item} size={size}>
      {children}
    </PhotoView>
  );
}

export function AboutMeScreen() {
  const { session, state, run } = useRoomCtx();
  const { room } = state;
  const topicIdx = TOPICS.findIndex((t) => t.id === room.topic);
  const topic = TOPICS[topicIdx];
  if (!topic) return null;

  const items = state.images.filter((i) => i.category === topic.id);
  const n = items.length;
  const stage = room.topicStage;
  const host = (action: string, extra: Record<string, unknown> = {}) =>
    run(api.host(session, action, { ...extra, expectedVersion: room.stateVersion }));
  const isLast = topicIdx === TOPICS.length - 1;

  return (
    <main className="screen">
      <div key={`${topic.id}-${stage}`} className="qslide">
        <header className="titlebar">
          <span className="pill">
            Topic {topicIdx + 1}/{TOPICS.length}
          </span>
          <h1>
            {topic.emoji} {topic.label}
          </h1>
          <p className="muted">{topic.intro}</p>
        </header>

        {stage === 'guess' && <GuessStage topic={topic.id} items={items} />}
        {stage === 'reveal' && <RevealStage items={items} />}
        {stage === 'summary' && <SummaryStage items={items} />}
      </div>

      {session.isHost && (
        <section className="card hostpanel">
          <span className="badge">Host panel</span>
          {stage === 'guess' && <GuessProgress items={items} />}
          <p />
          <div className="row wrap">
            {stage === 'reveal' && room.slideIndex > 0 && (
              <button className="btn" onClick={() => host('prev')}>
                ← Previous
              </button>
            )}
            <button className="btn primary" onClick={() => host(stage === 'summary' ? 'next_topic' : 'next')}>
              {nextLabel(stage, room.slideIndex, n, isLast)}
            </button>
          </div>
          <hr />
          <div className="row wrap">
            {!isLast && stage !== 'summary' && (
              <button className="btn ghost" onClick={() => host('next_topic')}>
                Skip this topic
              </button>
            )}
            {!(isLast && stage === 'summary') && (
              <button className="btn danger" onClick={() => host('finish')}>
                End activity
              </button>
            )}
          </div>
        </section>
      )}
    </main>
  );
}

function nextLabel(stage: string | null, idx: number, n: number, isLast: boolean) {
  const after = isLast ? 'End activity →' : 'Next topic →';
  if (stage === 'guess') return n === 0 ? after : '📊 Show answers →';
  if (stage === 'reveal') return idx + 1 < n ? 'Next answer →' : 'See topic results →';
  return after;
}

function EmptyTopic() {
  return (
    <p className="card muted center-text">Nobody submitted anything for this topic 🤷 The host can move on.</p>
  );
}

function GuessStage({ topic, items }: { topic: RoomImage['category']; items: RoomImage[] }) {
  const { session, state, run } = useRoomCtx();
  if (items.length === 0) return <EmptyTopic />;
  const others = state.participants.filter((p) => p.id !== session.participantId);
  const votable = items.filter((i) => !i.mine);
  const done = votable.filter((i) => state.guesses[i.id]?.myGuess).length;

  return (
    <>
      <p className="prompt-line">{TOPIC_PROMPTS[topic]}</p>
      <p className="votecount" role="status">
        Who does each one belong to? · You voted <strong>{done}</strong> of {votable.length}
      </p>
      <div className="guess-list">
        {items.map((item) => (
          <section key={item.id} className={`card guess ${item.mine ? 'mine' : ''}`}>
            <ItemView item={item} size="small" />
            {item.mine ? (
              <p className="muted center-text">This one is yours 😉 You don't vote on it.</p>
            ) : (
              <div className="chips" role="group" aria-label={`Who does number ${item.pos} belong to?`}>
                {others.map((p) => (
                  <button
                    key={p.id}
                    className={`chip ${state.guesses[item.id]?.myGuess === p.id ? 'picked' : ''}`}
                    aria-pressed={state.guesses[item.id]?.myGuess === p.id}
                    onClick={() => run(api.guess(session, item.id, p.id))}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </>
  );
}

function GuessProgress({ items }: { items: RoomImage[] }) {
  const { state } = useRoomCtx();
  const total = items.reduce((acc, i) => acc + (state.guesses[i.id]?.guessed ?? 0), 0);
  const expected = items.length * Math.max(state.participants.length - 1, 0);
  return (
    <p className="muted">
      Votes received: <strong>{total}</strong> of {expected}
    </p>
  );
}

function RevealStage({ items }: { items: RoomImage[] }) {
  const { state } = useRoomCtx();
  const current = items.find((i) => i.pos === state.room.slideIndex + 1);
  if (!current) return null;
  const reveal = state.reveals[current.id];
  return (
    <section className="card promptcard">
      <span className="pill alt">
        Answer {current.pos} of {items.length}
      </span>
      <ItemView key={current.id} item={current} />
      {reveal ? (
        <>
          <p className="prompt reveal-owner">🎉 It was {nameOf(state, reveal.ownerId)}'s!</p>
          {reveal.guesses.length === 0 ? (
            <p className="muted">Nobody voted on this one.</p>
          ) : (
            <ul className="verdicts">
              {reveal.guesses.map((g) => {
                const ok = g.guessedId === reveal.ownerId;
                return (
                  <li key={g.guesserId} className={ok ? 'ok' : 'no'}>
                    {ok ? '✅' : '❌'} {nameOf(state, g.guesserId)}
                    {!ok && <small> thought it was {nameOf(state, g.guessedId)}'s</small>}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      ) : (
        <p className="muted">Loading answer…</p>
      )}
    </section>
  );
}

function SummaryStage({ items }: { items: RoomImage[] }) {
  const { state } = useRoomCtx();
  if (items.length === 0) return <EmptyTopic />;

  const rows = state.participants
    .map((p) => {
      const eligible = items.filter((i) => state.reveals[i.id] && state.reveals[i.id].ownerId !== p.id);
      const correct = eligible.filter((i) =>
        state.reveals[i.id].guesses.some((g) => g.guesserId === p.id && g.guessedId === state.reveals[i.id].ownerId),
      ).length;
      return { id: p.id, name: p.name, correct, total: eligible.length };
    })
    .filter((r) => r.total > 0)
    .sort((a, b) => b.correct - a.correct || a.name.localeCompare(b.name));

  const medals = ['🥇', '🥈', '🥉'];
  return (
    <>
      <section className="card">
        <h2>Correct guesses this topic</h2>
        <ol className="ranking">
          {rows.map((r, i) => (
            <li key={r.id}>
              <span className="medal">{r.correct > 0 && i < 3 ? medals[i] : i + 1}</span>
              <span className="pname">{r.name}</span>
              <strong>
                {r.correct} / {r.total}
              </strong>
            </li>
          ))}
        </ol>
      </section>
      <section className="card">
        <h2>Everything and its owner</h2>
        <div className="grid">
          {items.map((item) => (
            <ItemView key={item.id} item={item} size="small">
              <strong>{state.reveals[item.id] ? nameOf(state, state.reveals[item.id].ownerId) : '…'}</strong>
            </ItemView>
          ))}
        </div>
      </section>
    </>
  );
}
