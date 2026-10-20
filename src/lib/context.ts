import { createContext, useContext } from 'react';
import type { RoomState, Session } from '../types/game';
import type { Snapshot } from './api';

export interface RoomCtx {
  session: Session;
  state: RoomState;
  /** Runs a mutation, applies the returned snapshot and reports errors. */
  run: (p: Promise<Snapshot | unknown>) => Promise<boolean>;
  error: string | null;
}

export const RoomContext = createContext<RoomCtx | null>(null);
export const useRoomCtx = () => {
  const c = useContext(RoomContext);
  if (!c) throw new Error('RoomContext missing');
  return c;
};
