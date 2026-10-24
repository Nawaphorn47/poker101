import type { CashGame } from '../engine/cashGame';
import type { Tournament } from '../engine/tournament';
import type { HandConfig } from '../engine/hand';
import type { Action } from '../engine/types';

export const RESUME_VERSION = 1;
const KEY = 'poker101.resume';

/** Enough to rebuild a session mid-hand: the game, the hand's config, and the actions so far. */
export type ResumeState = {
  version: number;
  mode: 'cash' | 'tournament';
  game: CashGame | Tournament;
  handConfig: HandConfig;
  actions: Action[];
  humanSeat: number;
  usedHint: boolean;
};

export function saveResume(state: ResumeState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable: resuming is a convenience, play continues */
  }
}

export function clearResume(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Returns null for missing, corrupt, wrong-version or malformed data. */
export function loadResume(): ResumeState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    const ok =
      s && s.version === RESUME_VERSION && (s.mode === 'cash' || s.mode === 'tournament') &&
      s.game && Array.isArray(s.game.players) && s.handConfig && Array.isArray(s.handConfig.seats) &&
      Array.isArray(s.actions) && typeof s.humanSeat === 'number';
    return ok ? (s as ResumeState) : null;
  } catch {
    return null;
  }
}
