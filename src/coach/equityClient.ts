import type { Card } from '../engine/cards';
import { mulberry32 } from '../engine/deck';
import { equity } from './equity';
import type { EquityRequest, EquityResponse } from './equityWorker';

let worker: Worker | null = null;
let nextId = 1;
const waiting = new Map<number, (e: number) => void>();

function getWorker(): Worker | null {
  if (typeof Worker === 'undefined') return null;
  if (!worker) {
    worker = new Worker(new URL('./equityWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<EquityResponse>) => {
      waiting.get(e.data.id)?.(e.data.equity);
      waiting.delete(e.data.id);
    };
  }
  return worker;
}

/** Equity via a Web Worker when available; falls back to computing inline (tests, old browsers). */
export function requestEquity(hole: Card[], board: Card[], opponents: number, samples = 2000): Promise<number> {
  const w = getWorker();
  if (!w) return Promise.resolve(equity(hole, board, opponents, samples, mulberry32(1)));
  return new Promise((resolve) => {
    const id = nextId++;
    waiting.set(id, resolve);
    const req: EquityRequest = { id, hole, board, opponents, samples };
    w.postMessage(req);
  });
}
