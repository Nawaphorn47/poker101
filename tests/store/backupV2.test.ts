import 'fake-indexeddb/auto';
import { saveHand, saveSession, saveDrillResult, listHands, listSessions, listDrillResults, clearAll } from '../../src/store/db';
import type { DrillResult } from '../../src/store/db';
import { exportBackup, importBackup } from '../../src/store/backup';
import type { HandLog } from '../../src/engine/handLog';

const hand = (id: string): HandLog => ({
  id, seed: 1, mode: 'cash', seats: [{ id: 0, stack: 1000 }, { id: 1, stack: 1000 }], button: 0,
  blinds: { sb: 10, bb: 20 }, actions: [{ seat: 0, action: { type: 'fold' } }], humanSeat: 1,
  usedHint: false, netBb: 0.5, timestamp: 1,
});
const drill = (id: string): DrillResult => ({
  id, type: 'odds', level: 2, key: 'odds:L2:flop:9', correct: true, borderline: false, timestamp: 5,
});
const session = { id: 's1', mode: 'cash' as const, profitBb: 3, endedAt: 9 };

beforeEach(async () => {
  await clearAll();
});

describe('backup v2', () => {
  it('export then import into an empty db restores hands, sessions and drill results', async () => {
    await saveHand(hand('h1'));
    await saveSession(session);
    await saveDrillResult(drill('d1'));
    const json = await exportBackup();
    expect(JSON.parse(json).version).toBe(2);
    await clearAll();
    expect(await importBackup(json)).toEqual({ ok: true });
    expect((await listHands()).map((h) => h.id)).toEqual(['h1']);
    expect((await listSessions()).map((s) => s.id)).toEqual(['s1']);
    expect((await listDrillResults()).map((d) => d.id)).toEqual(['d1']);
  });

  it('a version 1 backup file still imports', async () => {
    const v1 = JSON.stringify({ version: 1, hands: [hand('old')], sessions: [session] });
    expect(await importBackup(v1)).toEqual({ ok: true });
    expect((await listHands()).map((h) => h.id)).toEqual(['old']);
    expect(await listDrillResults()).toEqual([]);
  });

  it('a bad drill result fails the whole import and writes nothing', async () => {
    const bads = [
      { ...drill('x'), type: 'bogus' },
      { ...drill('x'), key: undefined },
      { ...drill('x'), correct: 'yes' },
    ];
    for (const bad of bads) {
      const json = JSON.stringify({ version: 2, hands: [hand('good')], sessions: [], drillResults: [bad] });
      expect((await importBackup(json)).ok).toBe(false);
      expect(await listHands()).toEqual([]);
      expect(await listDrillResults()).toEqual([]);
    }
  });

  it('a version 2 file without drillResults is rejected', async () => {
    const json = JSON.stringify({ version: 2, hands: [], sessions: [] });
    expect((await importBackup(json)).ok).toBe(false);
  });

  it('an unknown version is rejected', async () => {
    const json = JSON.stringify({ version: 3, hands: [], sessions: [], drillResults: [] });
    expect((await importBackup(json)).ok).toBe(false);
  });
});
