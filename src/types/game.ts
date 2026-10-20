export type Phase = 'lobby' | 'pick_a_side' | 'about_me' | 'finished';
export type ImageCategory = 'travel_destination' | 'meaningful_object';
export type Topic = ImageCategory | 'talent';
export type TopicStage = 'show' | 'guess' | 'reveal' | 'summary' | 'prompt';

export interface Session {
  roomId: string;
  participantId: string;
  token: string;
  isHost: boolean;
  joinCode: string;
}

export interface Room {
  id: string;
  joinCode: string;
  hostParticipantId: string;
  phase: Phase;
  currentQuestionId: string | null;
  currentPresenterId: string | null;
  topic: Topic | null;
  topicStage: TopicStage | null;
  slideIndex: number;
  votesOpen: boolean;
  resultsVisible: boolean;
  stateVersion: number;
}

export interface Participant {
  id: string;
  name: string;
  lastSeen: number;
  connected: boolean;
}

export interface VoteAggregate {
  questionId: string;
  voted: number;
  /** Only present once the host reveals results. */
  counts: [number, number] | null;
}

/** Photos are anonymous: the owner is only known to the server until the host reveals it. */
export interface RoomImage {
  id: string;
  /** For the talent topic the item has no file: `caption` holds the text. */
  category: Topic;
  caption: string | null;
  /** 1-based position in the shared (shuffled) order of its category. */
  pos: number;
  mine: boolean;
}

export interface GuessInfo {
  /** How many people have guessed this image so far (never who). */
  guessed: number;
  myGuess: string | null;
}

export interface Reveal {
  ownerId: string;
  guesses: { guesserId: string; guessedId: string }[];
}

export interface RoomState {
  room: Room;
  participants: Participant[];
  votes: Record<string, VoteAggregate>;
  myVotes: Record<string, number>;
  /** Who voted for what. Only filled for the question whose results are revealed. */
  voters: { participantId: string; questionId: string; option: number }[];
  images: RoomImage[];
  guesses: Record<string, GuessInfo>;
  reveals: Record<string, Reveal>;
}

export type SyncMode = 'connecting' | 'realtime' | 'polling' | 'offline';

/** Raw rows as returned by the API (snake_case), keyed by query. */
export interface RawSnapshot {
  room?: any[];
  participants?: any[];
  votes?: any[];
  voters?: any[];
  images?: any[];
  guesses?: any[];
  reveals?: any[];
}
