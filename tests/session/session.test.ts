import 'fake-indexeddb/auto';
import { createSession, type SessionDeps } from '../../src/session/session';
import { mulberry32 } from '../../src/engine/deck';
import { decide } from '../../src/bots/decide';
import type { HandLog } from '../../src/engine/handLog';
import type { SessionRecord } from '../../src/store/db';
import type { ResumeState } from '../../src/store/resume';
import type { Session } from '../../src/session/session';

function makeDeps(over: Partial<SessionDeps> = {}) {
  const hands: HandLog[] = [];
  const sessions: SessionRecord[] = [];
  const resumes: ResumeState[] = [];
  const deps: SessionDeps = {
    saveHand: async (h) => void hands.push(h),
    saveSession: async (s) => void sessions.push(s),
    saveResume: (r) => void resumes.push(r),
    rng: mulberry32(2024),
    now: () => 1000,
    decide,
    ...over,
  };
  return { deps, hands, sessions, resumes };
}

/** human folds or checks whenever it is their turn */
async function playHandPassively(s: Session) {
  for (let guard = 0; guard < 300 && s.state().street !== 'done'; guard++) {
    await s.runBotsUntilHuman();
    if (s.state().street === 'done') break;
    const legal = s.humanLegal()!;
    expect(s.submitHuman(legal.canCheck ? { type: 'check' } : { type: 'fold' }).ok).toBe(true);
  }
}

describe('session', () => {
  it('bots act until the human is to act', async () => {
    const { deps } = makeDeps();
    const s = createSession('cash', deps);
    await s.runBotsUntilHuman();
    expect(s.state().round.toAct).toBe(s.humanSeat());
    expect(s.humanLegal()).not.toBeNull();
  });

  it('finishing a hand saves one HandLog with all actions', async () => {
    const { deps, hands } = makeDeps();
    const s = createSession('cash', deps);
    await playHandPassively(s);
    await s.idle();
    expect(s.state().street).toBe('done');
    expect(hands).toHaveLength(1);
    expect(hands[0].actions).toHaveLength(s.state().log.length);
    expect(hands[0].mode).toBe('cash');
  });

  it("a bot's view never contains other seats' hole cards", async () => {
    const seen: string[] = [];
    const { deps } = makeDeps({
      decide: (view, style, rng) => {
        seen.push(JSON.stringify(view));
        return decide(view, style, rng);
      },
    });
    const s = createSession('cash', deps);
    await playHandPassively(s);
    const st = s.state();
    expect(seen.length).toBeGreaterThan(0);
    for (const json of seen) {
      const v = JSON.parse(json);
      for (const seat of st.seats) {
        if (seat.id === v.seat) continue;
        expect(json).not.toContain(JSON.stringify(seat.hole));
      }
    }
  });

  it('using a hint marks the saved hand', async () => {
    const { deps, hands } = makeDeps();
    const s = createSession('cash', deps);
    await s.runBotsUntilHuman();
    s.markHintUsed();
    await playHandPassively(s);
    await s.idle();
    expect(hands[0].usedHint).toBe(true);
  });

  it('next hand starts fresh, moves the button, and resets the hint flag', async () => {
    const { deps, hands } = makeDeps();
    const s = createSession('cash', deps);
    s.markHintUsed();
    await playHandPassively(s);
    const button1 = s.state().button;
    s.nextHand();
    await playHandPassively(s);
    await s.idle();
    expect(s.state().button).not.toBe(button1);
    expect(hands).toHaveLength(2);
    expect(hands[1].usedHint).toBe(false);
  });

  it('a tournament ends when the human busts or wins and saves a SessionRecord', async () => {
    const { deps, sessions } = makeDeps();
    const s = createSession('tournament', deps);
    for (let hands = 0; hands < 2000 && !s.isOver(); hands++) {
      for (let g = 0; g < 300 && s.state().street !== 'done'; g++) {
        await s.runBotsUntilHuman();
        if (s.state().street === 'done') break;
        const l = s.humanLegal()!;
        s.submitHuman(l.canRaise ? { type: s.state().round.currentBet === 0 ? 'bet' : 'raise', amount: l.maxRaiseTo } : l.canCheck ? { type: 'check' } : { type: 'call' });
      }
      await s.idle();
      if (!s.isOver()) s.nextHand();
    }
    expect(s.isOver()).toBe(true);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].mode).toBe('tournament');
    expect(sessions[0].place).toBeGreaterThanOrEqual(1);
    expect(sessions[0].place).toBeLessThanOrEqual(9);
  });

  it('a failed save sets a warning but play continues', async () => {
    const { deps } = makeDeps({ saveHand: async () => { throw new Error('disk full'); } });
    const s = createSession('cash', deps);
    await playHandPassively(s);
    await s.idle();
    expect(s.warning()).toMatch(/not saved/i);
    s.nextHand();
    expect(s.state().street).toBe('preflop');
  });

  it('restoring from a saved resume state continues the same hand', async () => {
    const { deps, resumes } = makeDeps();
    const s = createSession('cash', deps);
    await s.runBotsUntilHuman();
    s.submitHuman({ type: 'call' });
    await s.runBotsUntilHuman();
    const saved = JSON.parse(JSON.stringify(resumes[resumes.length - 1]));
    const { deps: deps2 } = makeDeps();
    const s2 = createSession('cash', deps2, saved);
    expect(s2.state().board).toEqual(s.state().board);
    expect(s2.state().round.toAct).toBe(s.state().round.toAct);
    expect(s2.state().log).toEqual(s.state().log);
  });
});
