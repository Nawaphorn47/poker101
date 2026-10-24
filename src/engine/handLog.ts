import type { Action } from './types';

/** Everything needed to replay a hand exactly. Seat numbers are engine seat indexes. */
export type HandLog = {
  id: string;
  seed: number;
  mode: 'cash' | 'tournament';
  seats: { id: number; stack: number }[];
  button: number;
  blinds: { sb: number; bb: number };
  actions: { seat: number; action: Action }[];
  humanSeat: number;
  usedHint: boolean;
  netBb: number;
  timestamp: number;
};
