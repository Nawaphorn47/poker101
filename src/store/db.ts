import { openDB, type IDBPDatabase } from 'idb';
import type { HandLog } from '../engine/handLog';
import type { DrillId } from '../drill/types';
import { isValidDrillResult } from './validate';

export type SessionRecord = {
  id: string;
  mode: 'cash' | 'tournament';
  place?: number;
  profitBb: number;
  endedAt: number;
};

export type DrillResult = {
  id: string;
  type: DrillId;
  level: number;
  /** scenario signature, e.g. preflop:BTN:none:AJo */
  key: string;
  correct: boolean;
  borderline: boolean;
  /** EV given up by the chosen answer, when the drill computes EV */
  evLoss?: number;
  timestamp: number;
};

const DB_NAME = 'poker101';
const DB_VERSION = 2;
let dbPromise: Promise<IDBPDatabase> | null = null;

function db(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) {
        d.createObjectStore('hands', { keyPath: 'id' });
        d.createObjectStore('sessions', { keyPath: 'id' });
      }
      if (oldVersion < 2) d.createObjectStore('drillResults', { keyPath: 'id' });
    },
    // another tab or a deletion needs the database: let go of our connection and reopen lazily
    blocking() {
      const closing = dbPromise;
      dbPromise = null;
      void closing?.then((d) => d.close());
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

export async function saveDrillResult(r: DrillResult): Promise<void> {
  await (await db()).put('drillResults', r);
}

/** Oldest first; records that do not have the expected shape are skipped. */
export async function listDrillResults(): Promise<DrillResult[]> {
  const all: unknown[] = await (await db()).getAll('drillResults');
  return all.filter(isValidDrillResult).sort((a, b) => a.timestamp - b.timestamp);
}

export async function clearAll(): Promise<void> {
  const d = await db();
  await d.clear('hands');
  await d.clear('sessions');
  await d.clear('drillResults');
}
