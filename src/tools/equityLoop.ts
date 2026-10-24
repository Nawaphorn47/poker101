import { mulberry32 } from '../engine/deck';
import { createSimulation, type EquityInput, type EquityResult } from './equity';

/**
 * Runs a simulation in chunks, yielding between chunks so the thread can handle other work.
 * Used both inside the Web Worker and as the main-thread fallback.
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
  const sim = createSimulation(input, mulberry32(seed));
  let done = 0;
  const tick = () => {
    if (shouldStop()) return;
    const n = Math.min(chunk, cap - done);
    sim.step(n);
    done += n;
    if (shouldStop()) return;
    emit(sim.result(), done >= cap);
    if (done < cap) schedule(tick);
  };
  schedule(tick);
}
