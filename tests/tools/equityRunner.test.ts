import { startEquity } from '../../src/tools/equityRunner';
import type { EquityInput, EquityResult } from '../../src/tools/equity';
import { parseCard } from '../../src/engine/cards';

const cards = (s: string) => (s.trim() === '' ? [] : s.trim().split(/\s+/).map(parseCard));
const input = (hands: string[], board = ''): EquityInput => ({ hands: hands.map(cards), board: cards(board) });
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Update = { r: EquityResult; done: boolean; note?: string };

/** runs to completion and returns every update received */
function runToEnd(i: EquityInput, opts: Parameters<typeof startEquity>[2] = {}): Promise<Update[]> {
  return new Promise((resolve) => {
    const updates: Update[] = [];
    startEquity(i, (r, done, note) => {
      updates.push({ r, done, note });
      if (done) resolve(updates);
    }, opts);
  });
}

const FAST = { useWorker: false, cap: 6000, chunk: 1000 } as const;

describe('startEquity', () => {
  it('a flop board delivers exactly one update, done and exact', async () => {
    const updates = await runToEnd(input(['As Ah', 'Ks Qs'], '2s 7s 9h'));
    await sleep(20);
    expect(updates).toHaveLength(1);
    expect(updates[0].done).toBe(true);
    expect(updates[0].r.ok && updates[0].r.exact).toBe(true);
    expect(updates[0].note).toBeUndefined();
  });

  it('an invalid input delivers one ok:false update', async () => {
    const updates = await runToEnd(input(['As Ah', 'As Kh']));
    expect(updates).toHaveLength(1);
    expect(updates[0].r.ok).toBe(false);
    expect(updates[0].done).toBe(true);
  });

  it('a board of 2 cards is reported as an error, not simulated', async () => {
    const updates = await runToEnd(input(['As Ah', 'Ks Kh'], '2c 7d'));
    expect(updates).toHaveLength(1);
    expect(updates[0].r.ok).toBe(false);
  });

  it('a preflop run delivers partial updates then a done update with half the cap in samples', async () => {
    const updates = await runToEnd(input(['As Ah', 'Ks Kh']), FAST);
    expect(updates.length).toBeGreaterThanOrEqual(3);
    expect(updates.slice(0, -1).every((u) => !u.done)).toBe(true);
    const last = updates[updates.length - 1];
    expect(last.done).toBe(true);
    expect(last.r.ok && last.r.samples).toBe(3000);
    expect(last.r.ok && last.r.exact).toBe(false);
  });

  it('the main-thread path carries the fallback note', async () => {
    const updates = await runToEnd(input(['As Ah', 'Ks Kh']), FAST);
    expect(updates.every((u) => typeof u.note === 'string' && u.note.length > 0)).toBe(true);
    const viaDefault = await runToEnd(input(['As Ah', 'Ks Kh']), { cap: 4000, chunk: 1000 });
    expect(typeof viaDefault[0].note).toBe('string'); // Worker is undefined in the test environment
  });

  it('stop() prevents any later update', async () => {
    const seen: Update[] = [];
    const handle = startEquity(input(['As Ah', 'Ks Kh']), (r, done, note) => {
      seen.push({ r, done, note });
      handle.stop();
    }, FAST);
    await sleep(150);
    expect(seen).toHaveLength(1);
  });

  it('a stopped run never reports even its done update, and a new run is unaffected', async () => {
    const stale: Update[] = [];
    const first = startEquity(input(['As Ah', 'Ks Kh']), (r, done) => stale.push({ r, done }), FAST);
    first.stop();
    const fresh = await runToEnd(input(['2c 2d', '3c 3d']), FAST);
    await sleep(50);
    expect(stale).toHaveLength(0);
    expect(fresh[fresh.length - 1].done).toBe(true);
  });

  it('stop() on an exact run before its result is delivered suppresses it', async () => {
    const seen: Update[] = [];
    const handle = startEquity(input(['As Ah', 'Ks Qs'], '2s 7s 9h'), (r, done) => seen.push({ r, done }));
    handle.stop();
    await sleep(20);
    expect(seen).toHaveLength(0);
  });
});
