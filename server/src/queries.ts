// Single source of truth for every read the client is allowed to make.
// Each query is scoped to a participant that the server already authenticated;
// the same SQL is used for the polling snapshot and for sealed Realtime queries.
//
// Privacy rules enforced here:
//  - votes: only aggregates (+ the caller's own vote); per-option counts only after the reveal.
//  - voters: who picked what, only for the question whose results the host has revealed.
//  - images: the owner (participant_id) is NEVER selected; only `mine` for the caller.
//  - guesses: only per-image counts and the caller's own guess until the host reveals.
//  - reveals: owner and everyone's guesses only for images already revealed by the host.

export interface Query {
  key: 'room' | 'participants' | 'votes' | 'voters' | 'images' | 'guesses' | 'reveals';
  sql: string;
  params: [participantId: string, roomId: string];
}

const MEMBER = `JOIN participants me ON me.room_id = $2::uuid AND me.id = $1::uuid`;

// Photos get a stable pseudo-random order (the same for everyone) so that order does not leak authorship.
const RANKED_IMAGES = `(
  SELECT i.*, row_number() OVER (PARTITION BY i.category ORDER BY md5(i.id::text))::int AS pos
  FROM participant_images i
  WHERE i.room_id = $2::uuid
) i`;

export function buildQueries(participantId: string, roomId: string): Query[] {
  const params: [string, string] = [participantId, roomId];
  return [
    {
      key: 'room',
      params,
      sql: `SELECT r.id, r.join_code, r.host_participant_id, r.phase, r.current_question_id,
                   r.current_presenter_id, r.topic, r.topic_stage, r.slide_index,
                   r.votes_open, r.results_visible, r.state_version::int AS state_version
            FROM rooms r ${MEMBER}
            WHERE r.id = $2::uuid`,
    },
    {
      key: 'participants',
      params,
      sql: `SELECT p.id, p.display_name, p.created_at, p.last_seen_at
            FROM participants p ${MEMBER}
            WHERE p.room_id = $2::uuid
            ORDER BY p.created_at, p.id`,
    },
    {
      key: 'votes',
      params,
      sql: `SELECT v.question_id,
                   count(*)::int AS voted,
                   CASE WHEN r.results_visible THEN (count(*) FILTER (WHERE v.option_index = 0))::int END AS count0,
                   CASE WHEN r.results_visible THEN (count(*) FILTER (WHERE v.option_index = 1))::int END AS count1,
                   max(CASE WHEN v.participant_id = $1::uuid THEN v.option_index END)::int AS my_vote
            FROM votes v
            JOIN rooms r ON r.id = v.room_id
            ${MEMBER}
            WHERE v.room_id = $2::uuid
            GROUP BY v.question_id, r.results_visible
            ORDER BY v.question_id`,
    },
    {
      key: 'voters',
      params,
      sql: `SELECT v.question_id, v.participant_id, v.option_index::int AS option_index
            FROM votes v
            JOIN rooms r ON r.id = v.room_id
            ${MEMBER}
            WHERE v.room_id = $2::uuid
              AND r.results_visible
              AND v.question_id = r.current_question_id
            ORDER BY v.participant_id`,
    },
    {
      key: 'images',
      params,
      sql: `SELECT i.id, i.category, i.caption, i.pos, (i.participant_id = $1::uuid) AS mine
            FROM ${RANKED_IMAGES} ${MEMBER}
            ORDER BY i.category, i.pos`,
    },
    {
      key: 'guesses',
      params,
      sql: `SELECT g.image_id,
                   count(*)::int AS guessed,
                   max(CASE WHEN g.guesser_id = $1::uuid THEN g.guessed_participant_id::text END) AS my_guess
            FROM guesses g ${MEMBER}
            WHERE g.room_id = $2::uuid
            GROUP BY g.image_id
            ORDER BY g.image_id`,
    },
    {
      key: 'reveals',
      params,
      sql: `SELECT i.id AS image_id, i.participant_id AS owner_id, g.guesser_id, g.guessed_participant_id
            FROM ${RANKED_IMAGES}
            JOIN rooms r ON r.id = i.room_id
            ${MEMBER}
            LEFT JOIN guesses g ON g.image_id = i.id
            WHERE r.topic_stage IN ('reveal', 'summary')
              AND i.category = r.topic
              AND (r.topic_stage = 'summary' OR i.pos <= r.slide_index + 1)
            ORDER BY i.pos, g.guesser_id`,
    },
  ];
}
