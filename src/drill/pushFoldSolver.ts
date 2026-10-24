export type SolveInput = {
  /** equity[i][j]: equity of class i against class j, ties counted half */
  equity: number[][];
  /** combination count per class; card removal between classes is ignored */
  weights: number[];
  /** effective stack in big blinds (the small blind's stack, blinds included) */
  stack: number;
};

export type SolveResult = {
  push: boolean[];
  call: boolean[];
  /** small blind EV (bb, relative to the hand start) of pushing each class; folding is -0.5 */
  evPush: number[];
  /** big blind EV (bb, relative to the hand start) of calling with each class; folding is -1 */
  evCall: number[];
  iterations: number;
};

const SB_FOLD = -0.5;
const BB_FOLD = -1;

/** BB EV of calling with each class when the SB pushes class i with probability pushProb[i]. */
function callEvs({ equity, weights, stack }: SolveInput, pushProb: number[]): number[] {
  const n = weights.length;
  let total = 0;
  for (let i = 0; i < n; i++) total += weights[i] * pushProb[i];
  return Array.from({ length: n }, (_, j) => {
    if (total <= 0) return BB_FOLD - 1; // nothing is pushed, so calling is never reached
    let eq = 0;
    for (let i = 0; i < n; i++) eq += weights[i] * pushProb[i] * equity[j][i];
    return 2 * stack * (eq / total) - stack;
  });
}

/** SB EV of pushing each class when the BB calls class j with probability callProb[j]. */
function pushEvs({ equity, weights, stack }: SolveInput, callProb: number[]): number[] {
  const n = weights.length;
  const all = weights.reduce((a, b) => a + b, 0);
  let callW = 0;
  for (let j = 0; j < n; j++) callW += weights[j] * callProb[j];
  if (callW <= 0) return Array(n).fill(1); // never called: the SB just wins the big blind
  const c = callW / all;
  return Array.from({ length: n }, (_, i) => {
    let eq = 0;
    for (let j = 0; j < n; j++) eq += weights[j] * callProb[j] * equity[i][j];
    return (1 - c) * 1 + c * (2 * stack * (eq / callW) - stack);
  });
}

/**
 * Fictitious play: each side best-responds to the running average of the other side's play.
 * Plain alternating best responses can cycle; the game is zero-sum, so the averages converge.
 */
export function solvePushFold(input: SolveInput, iterations = 4000): SolveResult {
  const n = input.weights.length;
  const avgPush: number[] = Array(n).fill(1);
  const avgCall: number[] = Array(n).fill(0);
  for (let t = 1; t <= iterations; t++) {
    const call = callEvs(input, avgPush).map((ev) => (ev > BB_FOLD ? 1 : 0));
    const push = pushEvs(input, avgCall).map((ev) => (ev > SB_FOLD ? 1 : 0));
    for (let k = 0; k < n; k++) {
      avgCall[k] += (call[k] - avgCall[k]) / (t + 1);
      avgPush[k] += (push[k] - avgPush[k]) / (t + 1);
    }
  }
  const evPush = pushEvs(input, avgCall);
  const evCall = callEvs(input, avgPush);
  return { push: evPush.map((v) => v > SB_FOLD), call: evCall.map((v) => v > BB_FOLD), evPush, evCall, iterations };
}
