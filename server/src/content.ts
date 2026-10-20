// Static activity content (ids only; display text lives in the frontend).
// Keep in sync with src/data/questions.ts in the frontend.
export const VOTE_QUESTION_IDS = ['q1', 'q2', 'q4', 'q5'] as const;

/** Categories that carry an uploaded file. */
export const IMAGE_CATEGORIES = ['travel_destination', 'meaningful_object'] as const;
export type ImageCategory = (typeof IMAGE_CATEGORIES)[number];

/** Order of the personal round. Every topic is a "guess whose it is" round. */
export const TOPICS = ['travel_destination', 'meaningful_object', 'talent'] as const;
export type Topic = (typeof TOPICS)[number];

export const MAX_TALENT_CHARS = 200;
