import type { ImageCategory, Topic } from '../types/game';

export interface VoteQuestion {
  id: string;
  options: [{ label: string; emoji: string }, { label: string; emoji: string }];
}

// Ids must match VOTE_QUESTION_IDS in server/src/content.ts
export const VOTE_QUESTIONS: VoteQuestion[] = [
  { id: 'q1', options: [{ label: 'Beach', emoji: '🏖️' }, { label: 'Mountain', emoji: '⛰️' }] },
  { id: 'q6', options: [{ label: 'Early bird', emoji: '🐦' }, { label: 'Night owl', emoji: '🦉' }] },
  { id: 'q2', options: [{ label: 'Adventure and excursions', emoji: '🧗' }, { label: 'Hotel and relaxing', emoji: '🛎️' }] },
  { id: 'q7', options: [{ label: 'Pizza', emoji: '🍕' }, { label: 'Sushi', emoji: '🍣' }] },
  { id: 'q10', options: [{ label: 'Sweet', emoji: '🍫' }, { label: 'Salty', emoji: '🍟' }] },
  { id: 'q8', options: [{ label: 'Work from home', emoji: '🏠' }, { label: 'Work from the office', emoji: '🏢' }] },
  { id: 'q4', options: [{ label: 'Teleporting', emoji: '✨' }, { label: 'Mind reading', emoji: '🧠' }] },
  { id: 'q11', options: [{ label: 'Visit the past', emoji: '⏪' }, { label: 'Visit the future', emoji: '⏩' }] },
  { id: 'q5', options: [{ label: 'Game night', emoji: '🎲' }, { label: 'Dinner out', emoji: '🍽️' }] },
  { id: 'q9', options: [{ label: 'Fly', emoji: '🦸' }, { label: 'Be invisible', emoji: '👻' }] },
];

/** Order of the personal round (keep in sync with TOPICS in server/src/content.ts). */
export const TOPICS: { id: Topic; label: string; emoji: string; intro: string }[] = [
  {
    id: 'travel_destination',
    label: 'Dream trip',
    emoji: '✈️',
    intro: 'Everyone shared a place they love or dream of visiting. Whose is whose?',
  },
  {
    id: 'meaningful_object',
    label: 'Meaningful object',
    emoji: '🎁',
    intro: 'Everyone shared an object that represents them. Can you tell who owns each one?',
  },
  {
    id: 'talent',
    label: 'Unexpected talent',
    emoji: '🎭',
    intro: 'Everyone wrote something nobody would guess they can do. Who is behind each one?',
  },
];

export const IMAGE_PROMPTS: Record<ImageCategory, { title: string; emoji: string; prompt: string; caption: string }> = {
  travel_destination: {
    title: 'A place in the world',
    emoji: '🗺️',
    prompt: 'What is a place you love or dream of traveling to?',
    caption: 'I picked this place because...',
  },
  meaningful_object: {
    title: 'An object with a story',
    emoji: '🎁',
    prompt: 'What object represents you or has a special story for you?',
    caption: 'This object matters to me because...',
  },
};

export const IMAGE_CATEGORY_LIST: ImageCategory[] = ['travel_destination', 'meaningful_object'];

export const TALENT_PROMPT = {
  title: 'An unexpected talent',
  emoji: '🎭',
  prompt: 'What can you do that nobody on this team would imagine?',
  placeholder: 'My unexpected talent is...',
};

/** Question shown above the items of each topic. */
export const TOPIC_PROMPTS: Record<Topic, string> = {
  travel_destination: IMAGE_PROMPTS.travel_destination.prompt,
  meaningful_object: IMAGE_PROMPTS.meaningful_object.prompt,
  talent: TALENT_PROMPT.prompt,
};
