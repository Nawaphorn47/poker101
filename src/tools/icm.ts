export type IcmResult =
  | { ok: true; values: number[]; shares: number[]; chipShares: number[] }
  | { ok: false; error: string };

const MAX_PLAYERS = 10;
const MAX_PAID_PLACES = 5;

/**
 * Malmuth-Harville ICM. Player i finishes first with probability stack_i / total; after removing the
 * winner the next place is drawn from the remaining stacks in proportion, and so on for each paid place.
 * Only ordered sequences of the paid places are enumerated (at most 10*9*8*7*6 = 30,240).
 */
export function icmEquities(stacks: number[], payouts: number[]): IcmResult {
  const n = stacks.length;
  if (n < 2 || n > MAX_PLAYERS) return { ok: false, error: `ICM needs 2 to ${MAX_PLAYERS} players.` };
  if (!stacks.every((s) => Number.isFinite(s) && s > 0)) return { ok: false, error: 'Every stack must be a number greater than 0.' };
  if (payouts.length < 1 || payouts.length > MAX_PAID_PLACES)
    return { ok: false, error: `Enter 1 to ${MAX_PAID_PLACES} payouts.` };
  if (payouts.length > n) return { ok: false, error: 'There cannot be more payouts than players.' };
  if (!payouts.every((p) => Number.isFinite(p) && p >= 0)) return { ok: false, error: 'Payouts must be numbers of 0 or more.' };

  const total = stacks.reduce((a, b) => a + b, 0);
  const values = new Array<number>(n).fill(0);
  const taken = new Array<boolean>(n).fill(false);

  const walk = (place: number, prob: number, remaining: number) => {
    if (place === payouts.length) return;
    for (let i = 0; i < n; i++) {
      if (taken[i]) continue;
      const p = prob * (stacks[i] / remaining);
      values[i] += p * payouts[place];
      taken[i] = true;
      walk(place + 1, p, remaining - stacks[i]);
      taken[i] = false;
    }
  };
  walk(0, 1, total);

  const pool = payouts.reduce((a, b) => a + b, 0);
  return {
    ok: true,
    values,
    shares: values.map((v) => (pool > 0 ? v / pool : 0)),
    chipShares: stacks.map((s) => s / total),
  };
}
