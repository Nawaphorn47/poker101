import { mulberry32 } from '../engine/deck';
import { createSimulation, type EquityInput, type EquityResult } from './equity';

export const CALCULATION_FAILED = 'Could not calculate equity.';

/**
 * Runs a simulation in chunks, yielding between chunks so the thread can handle other work.
 * Used both inside the Web Worker and as the main-thread fallback. If anything throws, a single
 * error result is emitted and the run ends, so the page never waits on a calculation that died.
 */
export function runSimulation(
  input: EquityInput,
  seed: number,
  cap: number,
  chunk: number,
  emit: (result: EquityResult, done: boolean) => void,
  shouldStop: () => boolean,
  schedule: (fn: () => void) => void = (fn) => void setTimeout(fn, 0),
): void {
  let sim: ReturnType<typeof createSimulation>;
  let done = 0;
  const fail = () => {
    if (!shouldStop()) emit({ ok: false, error: CALCULATION_FAILED }, true);
  };
  const tick = () => {
    if (shouldStop()) return;
    try {
      sim ??= createSimulation(input, mulberry32(seed));
      const n = Math.min(chunk, cap - done);
      sim.step(n);
      done += n;
      if (shouldStop()) return;
      emit(sim.result(), done >= cap);
      if (done < cap) schedule(tick);
    } catch {
      fail();
    }
  };
  schedule(tick);
}
