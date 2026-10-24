import 'fake-indexeddb/auto';
import { openDB } from 'idb';
import type { DrillResult } from '../../src/store/db';

const result = (id: string, over: Partial<DrillResult> = {}): DrillResult => ({
  id, type: 'preflop', level: 1, key: 'preflop:BTN:none:AJo', correct: true, borderline: false, timestamp: 1, ...over,
});

async function freshDb() {
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('poker101');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
  vi.resetModules();
  return import('../../src/store/db');
}

describe('database version 2', () => {
  it('a version 1 database with saved hands opens at version 2 with every hand intact', async () => {
    await new Promise<void>((r) => { indexedDB.deleteDatabase('poker101').onsuccess = () => r(); });
    const v1 = await openDB('poker101', 1, {
      upgrade(d) {
        d.createObjectStore('hands', { keyPath: 'id' });
        d.createObjectStore('sessions', { keyPath: 'id' });
      },
    });
    await v1.put('hands', { id: 'h1', timestamp: 1 });
    await v1.put('hands', { id: 'h2', timestamp: 2 });
    await v1.put('sessions', { id: 's1', endedAt: 1 });
    v1.close();
    vi.resetModules();
    const db = await import('../../src/store/db');
    expect((await db.listHands()).map((h) => h.id)).toEqual(['h1', 'h2']);
    expect((await db.listSessions()).map((s) => s.id)).toEqual(['s1']);
    await db.saveDrillResult(result('d1'));
    expect(await db.listDrillResults()).toHaveLength(1);
  });

  it('a saved drill result round-trips', async () => {
    const db = await freshDb();
    const r = result('d1', { evLoss: 0.4, borderline: true });
    await db.saveDrillResult(r);
    expect(await db.listDrillResults()).toEqual([r]);
  });

  it('results come back oldest first', async () => {
    const db = await freshDb();
    await db.saveDrillResult(result('b', { timestamp: 20 }));
    await db.saveDrillResult(result('a', { timestamp: 10 }));
    expect((await db.listDrillResults()).map((r) => r.id)).toEqual(['a', 'b']);
  });

  it('a stored record with the wrong shape is skipped', async () => {
    const db = await freshDb();
    await db.saveDrillResult(result('good'));
    const raw = await openDB('poker101', 2);
    await raw.put('drillResults', { id: 'bad', type: 'nonsense', correct: 'yes' });
    raw.close();
    expect((await db.listDrillResults()).map((r) => r.id)).toEqual(['good']);
  });

  it('clearAll also clears drill results', async () => {
    const db = await freshDb();
    await db.saveDrillResult(result('d1'));
    await db.clearAll();
    expect(await db.listDrillResults()).toEqual([]);
  });
});
