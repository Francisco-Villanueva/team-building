import { api } from '../lib/api';
import { useRoomCtx } from '../lib/context';
import { QuestionCard } from '../components/QuestionCard';
import { VoteResults } from '../components/VoteResults';
import { Confetti } from '../components/Confetti';
import { VOTE_QUESTIONS } from '../data/questions';

export function PickASideScreen() {
  const { session, state, run } = useRoomCtx();
  const { room, participants } = state;
  const idx = VOTE_QUESTIONS.findIndex((q) => q.id === room.currentQuestionId);
  const question = VOTE_QUESTIONS[idx];
  if (!question) return null;

  const agg = state.votes[question.id];
  const myVote = state.myVotes[question.id];
  const voted = agg?.voted ?? 0;
  const last = idx === VOTE_QUESTIONS.length - 1;
  const counts = room.resultsVisible ? agg?.counts : null;
  // Everyone (at least two people) picked the same side
  const unanimous = Boolean(counts) && counts![0] + counts![1] >= 2 && (counts![0] === 0 || counts![1] === 0);
  const votersFor = (option: number) =>
    state.voters.filter((v) => v.questionId === question.id && v.option === option).map((v) => v.participantId);
  const host = (action: string, extra: Record<string, unknown> = {}) =>
    run(api.host(session, action, { ...extra, expectedVersion: room.stateVersion }));

  return (
    <main className="screen">
      {unanimous && <Confetti key={question.id} />}
      {/* Re-keying per question replays the enter transition between questions */}
      <div key={question.id} className="qslide">
        <header className="titlebar">
          <span className="pill">
            Pick a side · {idx + 1}/{VOTE_QUESTIONS.length}
          </span>
          <h1>Which one do you pick?</h1>
        </header>

        <QuestionCard
          question={question}
          myVote={myVote}
          disabled={!room.votesOpen}
          onVote={(i) => run(api.vote(session, question.id, i))}
        />

        <p className="votecount" role="status">
          {myVote === undefined
            ? room.votesOpen
              ? 'Tap an option to vote'
              : 'Voting is closed'
            : '✓ You voted, you can still change it'}
          {' · '}
          <strong>{voted}</strong> of {participants.length} voted
        </p>

        {counts && (
          <section className="card">
            <h2>{unanimous ? '🎉 Unanimous!' : 'Results'}</h2>
            <VoteResults
              question={question}
              counts={counts}
              myVote={myVote}
              voters={[0, 1].map((o) => votersFor(o)) as [string[], string[]]}
              names={Object.fromEntries(participants.map((p) => [p.id, p.name]))}
              nonVoters={participants
                .filter((p) => !state.voters.some((v) => v.participantId === p.id))
                .map((p) => p.id)}
            />
          </section>
        )}
        {room.resultsVisible && !counts && <p className="muted center-text">Nobody voted this time 🤷</p>}
      </div>

      {session.isHost && (
        <section className="card hostpanel">
          <span className="badge">Host panel</span>
          <p />
          <div className="row wrap">
            {!room.resultsVisible && (
              <>
                <button className="btn" onClick={() => host('set_votes_open', { open: !room.votesOpen })}>
                  {room.votesOpen ? '⏸ Close voting' : '▶ Reopen voting'}
                </button>
                <button className="btn primary" onClick={() => host('reveal')}>
                  📊 Show results
                </button>
              </>
            )}
            <button className={`btn ${room.resultsVisible ? 'primary' : ''}`} onClick={() => host('next_question')}>
              {last ? 'Go to the personal round →' : 'Next question →'}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}
