/** Fraction of equity needed to break even; `pot` already includes the opponent's bet. */
export function requiredEquity(call: number, pot: number): number {
  return call / (pot + call);
}

function choose(n: number, k: number): number {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return r;
}

/** Chance to hit at least one of `outs` by the river (flop, 47 unseen) or on the next card (turn, 46 unseen). */
export function outsEquity(outs: number, street: 'flop' | 'turn'): number {
  if (street === 'turn') return outs / 46;
  return 1 - choose(47 - outs, 2) / choose(47, 2);
}

/** Rule of 4 on the flop, rule of 2 on the turn, as a fraction. */
export function ruleOfEstimate(outs: number, street: 'flop' | 'turn'): number {
  return (outs * (street === 'flop' ? 4 : 2)) / 100;
}

/** Showdown EV of calling: win `pot` with probability `equity`, lose `call` otherwise. */
export function evCall(equity: number, pot: number, call: number): number {
  return equity * pot - (1 - equity) * call;
}
