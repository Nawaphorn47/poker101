import 'fake-indexeddb/auto';
import { saveHand, listHands, saveSession, listSessions, clearAll } from '../../src/store/db';
import { computeStats } from '../../src/store/stats';
import { exportBackup, importBackup } from '../../src/store/backup';
import { saveResume, loadResume, RESUME_VERSION, type ResumeState } from '../../src/store/resume';
import type { HandLog } from '../../src/engine/handLog';
import { newCashGame } from '../../src/engine/cashGame';

const log = (id: string, humanSeat: number, actions: HandLog['actions'], netBb = 0): HandLog => ({
  id, seed: 1, mode: 'cash', seats: [{ id: 0, stack: 1000 }, { id: 1, stack: 1000 }], button: 0,
  blinds: { sb: 10, bb: 20 }, actions, humanSeat, usedHint: false, netBb, timestamp: 1,
});

beforeEach(async () => {
  await clearAll();
  const store = new Map<string, string>();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

describe('db', () => {
  it('saved hand round-trips', async () => {
    const h = log('a', 1, [{ seat: 0, action: { type: 'fold' } }], 1);
    await saveHand(h);
    expect(await listHands()).toEqual([h]);
  });
  it('saved session round-trips', async () => {
    const s = { id: 's1', mode: 'tournament' as const, place: 2, profitBb: -5, endedAt: 9 };
    await saveSession(s);
    expect(await listSessions()).toEqual([s]);
  });
  it('write failure is surfaced as a rejected promise', async () => {
    const bad = { ...log('bad', 1, []), actions: [() => 1] } as unknown as HandLog;
    await expect(saveHand(bad)).rejects.toBeTruthy();
  });
});

describe('computeStats', () => {
  const hands = [
    // human is BB (seat 1): opponent raises, human folds -> not voluntary
    log('1', 1, [{ seat: 0, action: { type: 'raise', amount: 40 } }, { seat: 1, action: { type: 'fold' } }], -1),
    // human is SB (seat 0): completes the blind -> voluntary, not a raise
    log('2', 0, [{ seat: 0, action: { type: 'call' } }, { seat: 1, action: { type: 'fold' } }], 1),
    // human is SB: raises, opponent folds -> voluntary and PFR
    log('3', 0, [{ seat: 0, action: { type: 'raise', amount: 60 } }, { seat: 1, action: { type: 'fold' } }], 1),
    // human is BB: opponent limps, human checks the option -> not voluntary
    log('4', 1, [{ seat: 0, action: { type: 'call' } }, { seat: 1, action: { type: 'check' } },
      { seat: 1, action: { type: 'check' } }, { seat: 0, action: { type: 'fold' } }], 1),
  ];
  it('VPIP counts voluntary preflop money only (blinds excluded)', () => {
    const s = computeStats(hands);
    expect(s.hands).toBe(4);
    expect(s.vpip).toBeCloseTo(2 / 4);
    expect(s.pfr).toBeCloseTo(1 / 4);
  });
  it('bb/100 is total net bb per 100 hands', () => {
    expect(computeStats(hands).bbPer100).toBeCloseTo((2 / 4) * 100);
  });
  it('returns zeros for no hands', () => {
    expect(computeStats([])).toEqual({ hands: 0, vpip: 0, pfr: 0, bbPer100: 0, showdownWinRate: 0 });
  });
});

describe('backup', () => {
  it('export then import into an empty db restores all hands', async () => {
    await saveHand(log('a', 1, [{ seat: 0, action: { type: 'fold' } }]));
    await saveHand(log('b', 0, [{ seat: 0, action: { type: 'fold' } }]));
    const json = await exportBackup();
    await clearAll();
    expect(await importBackup(json)).toEqual({ ok: true });
    expect((await listHands()).map((h) => h.id).sort()).toEqual(['a', 'b']);
  });
  it('import of invalid JSON returns ok:false and changes nothing', async () => {
    await saveHand(log('keep', 1, []));
    const r = await importBackup('{not json');
    expect(r.ok).toBe(false);
    const r2 = await importBackup(JSON.stringify({ version: 1, hands: [{ nope: true }], sessions: [] }));
    expect(r2.ok).toBe(false);
    expect((await listHands()).map((h) => h.id)).toEqual(['keep']);
  });
});

describe('resume', () => {
  const state = (): ResumeState => ({
    version: RESUME_VERSION, mode: 'cash', game: newCashGame([0, 1]), humanSeat: 0, usedHint: false,
    handConfig: { seed: 1, seats: [{ id: 0, stack: 200 }, { id: 1, stack: 200 }], buttonSeat: 0, smallBlind: 1, bigBlind: 2 },
    actions: [{ type: 'call' }],
  });
  it('round-trips a saved resume state', () => {
    saveResume(state());
    expect(loadResume()).toEqual(state());
  });
  it('loadResume returns null when nothing saved', () => {
    expect(loadResume()).toBeNull();
  });
  it('loadResume returns null for corrupt JSON and for wrong version', () => {
    localStorage.setItem('poker101.resume', '{oops');
    expect(loadResume()).toBeNull();
    localStorage.setItem('poker101.resume', JSON.stringify({ ...state(), version: RESUME_VERSION + 1 }));
    expect(loadResume()).toBeNull();
    localStorage.setItem('poker101.resume', JSON.stringify({ version: RESUME_VERSION, mode: 'cash' }));
    expect(loadResume()).toBeNull();
  });
});
