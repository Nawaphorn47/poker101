import 'fake-indexeddb/auto';
import { createSession, type SessionDeps } from '../../src/session/session';
import { mulberry32 } from '../../src/engine/deck';
import { decide } from '../../src/bots/decide';
import type { SessionRecord } from '../../src/store/db';
import type { ResumeState } from '../../src/store/resume';

function makeDeps(over: Partial<SessionDeps> = {}) {
  const sessions: SessionRecord[] = [];
  const resumes: ResumeState[] = [];
  const deps: SessionDeps = {
    saveHand: async () => {},
    saveSession: async (s) => void sessions.push(s),
    saveResume: (r) => void resumes.push(r),
    rng: mulberry32(2024),
    now: () => 1000,
    decide,
    ...over,
  };
  return { deps, sessions, resumes };
}

describe('session review fixes', () => {
  it('a restored cash session keeps its rebuy count so profit stays correct', async () => {
    const { deps, resumes } = makeDeps();
    createSession('cash', deps);
    const saved = JSON.parse(JSON.stringify(resumes[resumes.length - 1])) as ResumeState;
    saved.buyIns = 3; // the human had bought in three times before the reload
    const { deps: deps2, sessions } = makeDeps();
    const s2 = createSession('cash', deps2, saved);
    await s2.leave();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].profitBb).toBe((200 - 3 * 200) / 2);
  });

  it('leaving the table stops the bot loop: nothing is saved afterwards', async () => {
    const { deps, resumes, sessions } = makeDeps({ pause: () => new Promise((r) => setTimeout(r, 0)) });
    const s = createSession('cash', deps);
    const run = s.runBotsUntilHuman(); // first bot acts synchronously, then waits on pause
    await s.leave();
    const savesAtLeave = resumes.length;
    await run;
    await new Promise((r) => setTimeout(r, 20));
    expect(resumes.length).toBe(savesAtLeave);
    expect(sessions).toHaveLength(1);
  });

  it('quitting a tournament also stops the bot loop', async () => {
    const { deps, resumes } = makeDeps({ pause: () => new Promise((r) => setTimeout(r, 0)) });
    const s = createSession('tournament', deps);
    const run = s.runBotsUntilHuman();
    await s.leave();
    const savesAtLeave = resumes.length;
    await run;
    await new Promise((r) => setTimeout(r, 20));
    expect(resumes.length).toBe(savesAtLeave);
  });
});
