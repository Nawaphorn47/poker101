import type { Card } from '../engine/cards';
import { mulberry32 } from '../engine/deck';
import { equity } from './equity';

export type EquityRequest = { id: number; hole: Card[]; board: Card[]; opponents: number; samples: number };
export type EquityResponse = { id: number; equity: number };

// Web Worker entry point: `new Worker(new URL('./equityWorker.ts', import.meta.url), { type: 'module' })`.
const ctx = self as unknown as {
  onmessage: ((e: { data: EquityRequest }) => void) | null;
  postMessage: (m: EquityResponse) => void;
};

ctx.onmessage = (e) => {
  const { id, hole, board, opponents, samples } = e.data;
  ctx.postMessage({ id, equity: equity(hole, board, opponents, samples, mulberry32(id + 1)) });
};
