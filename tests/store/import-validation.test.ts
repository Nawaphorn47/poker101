import 'fake-indexeddb/auto';
import { saveHand, listHands, clearAll } from '../../src/store/db';
import { importBackup } from '../../src/store/backup';
import { computeStats } from '../../src/store/stats';
import type { HandLog } from '../../src/engine/handLog';

const good = (id: string): HandLog => ({
  id, seed: 1, mode: 'cash', seats: [{ id: 0, stack: 1000 }, { id: 1, stack: 1000 }], button: 0,
  blinds: { sb: 10, bb: 20 }, actions: [{ seat: 0, action: { type: 'fold' } }], humanSeat: 1,
  usedHint: false, netBb: 0.5, timestamp: 1,
});
const pack = (hands: unknown[]) => JSON.stringify({ version: 1, hands, sessions: [] });

beforeEach(async () => {
  await clearAll();
});

describe('importBackup rejects records that cannot be replayed', () => {
  it('an action entry without an action', async () => {
    const bad = { ...good('x'), actions: [{ seat: 0 }] };
    expect((await importBackup(pack([bad]))).ok).toBe(false);
    expect(await listHands()).toEqual([]);
  });
  it('empty seats', async () => {
    expect((await importBackup(pack([{ ...good('x'), seats: [] }]))).ok).toBe(false);
  });
  it('humanSeat outside the seats', async () => {
    expect((await importBackup(pack([{ ...good('x'), humanSeat: 9 }]))).ok).toBe(false);
  });
  it('an illegal action sequence', async () => {
    const bad = { ...good('x'), actions: [{ seat: 0, action: { type: 'check' } }] };
    expect((await importBackup(pack([bad]))).ok).toBe(false);
  });
  it('one bad record means nothing is imported, good records included', async () => {
    const r = await importBackup(pack([good('ok'), { ...good('bad'), seats: [] }]));
    expect(r.ok).toBe(false);
    expect(await listHands()).toEqual([]);
  });
  it('a valid record still imports', async () => {
    expect(await importBackup(pack([good('ok')]))).toEqual({ ok: true });
    expect((await listHands()).map((h) => h.id)).toEqual(['ok']);
  });
});

describe('computeStats tolerates a record that already got into storage', () => {
  it('skips the unreplayable hand instead of throwing', async () => {
    await saveHand({ ...good('bad'), seats: [] });
    await saveHand(good('ok'));
    const stats = computeStats(await listHands());
    expect(stats.hands).toBe(1);
  });
});
