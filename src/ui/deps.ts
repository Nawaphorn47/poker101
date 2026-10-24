import { decide } from '../bots/decide';
import { mulberry32 } from '../engine/deck';
import { saveHand, saveSession } from '../store/db';
import { saveResume } from '../store/resume';
import type { SessionDeps } from '../session/session';

export function realDeps(): SessionDeps {
  return {
    saveHand,
    saveSession,
    saveResume,
    rng: mulberry32(Date.now() & 0x7fffffff),
    now: Date.now,
    decide,
    pause: () => new Promise((r) => setTimeout(r, 450)),
  };
}
