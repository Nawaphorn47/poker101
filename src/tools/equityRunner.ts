import { enumerateEquity, samplesFor, validateEquityInput, type EquityInput, type EquityResult } from './equity';
import { CALCULATION_FAILED, runSimulation } from './equityLoop';
import type { ToolWorkerRequest, ToolWorkerResponse } from './equityToolWorker';

export type RunHandle = { stop(): void };

export type RunOptions = {
  /** set false to force the main-thread path */
  useWorker?: boolean;
  seed?: number;
  /** sample cap override (tests) */
  cap?: number;
  /** samples per chunk (default 20,000, which is also the update interval) */
  chunk?: number;
};

export const FALLBACK_NOTE = 'Simulated on the main thread with fewer samples.';

/**
 * Starts an equity calculation. Boards of 3-5 cards are enumerated exactly; with no board the result is a
 * simulation that reports partial results. After `stop()` no further update is ever delivered.
 */
export function startEquity(
  input: EquityInput,
  onUpdate: (result: EquityResult, done: boolean, note?: string) => void,
  opts: RunOptions = {},
): RunHandle {
  let stopped = false;
  let worker: Worker | null = null;
  const emit = (r: EquityResult, done: boolean, note?: string) => {
    if (!stopped) onUpdate(r, done, note);
  };
  const handle: RunHandle = {
    stop() {
      stopped = true;
      worker?.terminate();
      worker = null;
    },
  };

  const error = validateEquityInput(input);
  if (error) {
    queueMicrotask(() => emit({ ok: false, error }, true));
    return handle;
  }
  if (input.board.length >= 3) {
    queueMicrotask(() => {
      try {
        emit(enumerateEquity(input), true);
      } catch {
        emit({ ok: false, error: CALCULATION_FAILED }, true);
      }
    });
    return handle;
  }

  const seed = opts.seed ?? Date.now() % 2_147_483_647;
  const cap = opts.cap ?? samplesFor(input.hands.length);
  const workerChunk = opts.chunk ?? 20_000;
  // on the main thread each slice blocks input, so keep slices short (about 30ms)
  const mainChunk = opts.chunk ?? 5_000;

  const mainThread = () =>
    runSimulation(input, seed, Math.max(1, Math.floor(cap / 2)), mainChunk, (r, d) => emit(r, d, FALLBACK_NOTE), () => stopped);

  if (opts.useWorker === false || typeof Worker === 'undefined') {
    mainThread();
    return handle;
  }
  try {
    worker = new Worker(new URL('./equityToolWorker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<ToolWorkerResponse>) => emit(e.data.result, e.data.done);
    worker.onerror = () => {
      worker?.terminate();
      worker = null;
      if (!stopped) mainThread();
    };
    const request: ToolWorkerRequest = { type: 'start', input, seed, cap, chunk: workerChunk };
    worker.postMessage(request);
  } catch {
    worker = null;
    mainThread();
  }
  return handle;
}
