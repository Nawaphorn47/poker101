import type { EquityInput, EquityResult } from './equity';
import { runSimulation } from './equityLoop';

export type ToolWorkerRequest = { type: 'start'; input: EquityInput; seed: number; cap: number; chunk: number };
export type ToolWorkerResponse = { result: EquityResult; done: boolean };

// Web Worker entry point; the runner stops it with worker.terminate().
const ctx = self as unknown as {
  onmessage: ((e: { data: ToolWorkerRequest }) => void) | null;
  postMessage: (m: ToolWorkerResponse) => void;
};

ctx.onmessage = (e) => {
  const { input, seed, cap, chunk } = e.data;
  runSimulation(input, seed, cap, chunk, (result, done) => ctx.postMessage({ result, done }), () => false);
};
