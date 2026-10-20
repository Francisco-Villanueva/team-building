import type { VoteQuestion } from '../data/questions';

export function QuestionCard({
  question,
  myVote,
  disabled,
  onVote,
}: {
  question: VoteQuestion;
  myVote?: number;
  disabled: boolean;
  onVote: (i: number) => void;
}) {
  return (
    <div className="choices">
      {question.options.map((o, i) => (
        <button
          key={i}
          className={`choice c${i} ${myVote === i ? 'picked' : ''}`}
          disabled={disabled}
          aria-pressed={myVote === i}
          onClick={() => onVote(i)}
        >
          <span className="emoji">{o.emoji}</span>
          <span className="label">{o.label}</span>
          {myVote === i && <span className="check">✓ Your pick</span>}
        </button>
      ))}
    </div>
  );
}
