import 'fake-indexeddb/auto';
import { isValidDrillResult } from '../../src/store/validate';
import { summarise } from '../../src/drill/progress';
import { importBackup } from '../../src/store/backup';
import { listDrillResults, clearAll } from '../../src/store/db';

const rec = (type: string, id = 'r1') => ({
  id, type, level: 1, key: `${type}:k`, correct: true, borderline: false, timestamp: 1,
});

const NEW_TYPES = ['madehand', 'outs', 'vsrange'];
const OLD_TYPES = ['odds', 'preflop', 'pushfold'];

describe('drill type registration', () => {
  it('the stored-record check accepts the three new types and the three old ones', () => {
    for (const t of [...NEW_TYPES, ...OLD_TYPES]) expect(isValidDrillResult(rec(t))).toBe(true);
  });
  it('an unknown type is still rejected', () => {
    expect(isValidDrillResult(rec('bluffing'))).toBe(false);
    expect(isValidDrillResult(rec(''))).toBe(false);
  });
  it('summarise has an entry for each of the six types', () => {
    const s = summarise([]);
    for (const t of [...NEW_TYPES, ...OLD_TYPES]) {
      expect((s.byType as Record<string, unknown>)[t]).toEqual({ total: 0, correct: 0, accuracy: 0 });
    }
  });
  it('summarise counts results of the new types', () => {
    const s = summarise([rec('vsrange', 'a'), rec('vsrange', 'b'), rec('outs', 'c')] as never);
    expect((s.byType as Record<string, { total: number }>).vsrange.total).toBe(2);
    expect((s.byType as Record<string, { total: number }>).outs.total).toBe(1);
    expect(s.total).toBe(3);
  });
});

describe('backup import with the new types', () => {
  beforeEach(async () => {
    await clearAll();
  });
  it('a version 2 backup holding a vsrange result imports', async () => {
    const json = JSON.stringify({ version: 2, hands: [], sessions: [], drillResults: [rec('vsrange')] });
    expect(await importBackup(json)).toEqual({ ok: true });
    expect((await listDrillResults()).map((r) => r.type)).toEqual(['vsrange']);
  });
  it('an unknown type fails the whole import and writes nothing', async () => {
    const json = JSON.stringify({ version: 2, hands: [], sessions: [], drillResults: [rec('outs', 'a'), rec('bluffing', 'b')] });
    expect((await importBackup(json)).ok).toBe(false);
    expect(await listDrillResults()).toEqual([]);
  });
  it('old results still import', async () => {
    const json = JSON.stringify({ version: 2, hands: [], sessions: [], drillResults: OLD_TYPES.map((t, i) => rec(t, `o${i}`)) });
    expect(await importBackup(json)).toEqual({ ok: true });
    expect(await listDrillResults()).toHaveLength(3);
  });
});
