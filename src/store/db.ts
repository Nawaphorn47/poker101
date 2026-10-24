import { openDB, type IDBPDatabase } from 'idb';
import type { HandLog } from '../engine/handLog';

export type SessionRecord = {
  id: string;
  mode: 'cash' | 'tournament';
  place?: number;
  profitBb: number;
  endedAt: number;
};

const DB_NAME = 'poker101';
let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, 1, {
    upgrade(d) {
      d.createObjectStore('hands', { keyPath: 'id' });
      d.createObjectStore('sessions', { keyPath: 'id' });
    },
  });
  return dbPromise;
}

export async function saveHand(log: HandLog): Promise<void> {
  await (await db()).put('hands', log);
}

export async function listHands(): Promise<HandLog[]> {
  const all: HandLog[] = await (await db()).getAll('hands');
  return all.sort((a, b) => a.timestamp - b.timestamp);
}

export async function saveSession(s: SessionRecord): Promise<void> {
  await (await db()).put('sessions', s);
}

export async function listSessions(): Promise<SessionRecord[]> {
  const all: SessionRecord[] = await (await db()).getAll('sessions');
  return all.sort((a, b) => a.endedAt - b.endedAt);
}

export async function clearAll(): Promise<void> {
  const d = await db();
  await d.clear('hands');
  await d.clear('sessions');
}
