import { compareScores, type HandScore } from './handEvaluator';

export type Contribution = { seat: number; amount: number; folded: boolean };
export type Pot = { amount: number; eligible: number[] };

export function buildPots(contribs: Contribution[]): Pot[] {
  const levels = [...new Set(contribs.filter((c) => !c.folded && c.amount > 0).map((c) => c.amount))].sort(
    (a, b) => a - b,
  );
  const pots: Pot[] = [];
  let prev = 0;
  for (const level of levels) {
    let amount = 0;
    for (const c of contribs) amount += Math.min(c.amount, level) - Math.min(c.amount, prev);
    const eligible = contribs.filter((c) => !c.folded && c.amount >= level).map((c) => c.seat);
    pots.push({ amount, eligible });
    prev = level;
  }
  // chips from folded players above the highest live level stay in the last pot
  const covered = pots.reduce((a, p) => a + p.amount, 0);
  const total = contribs.reduce((a, c) => a + c.amount, 0);
  if (pots.length > 0 && total > covered) pots[pots.length - 1].amount += total - covered;
  return pots;
}

export function distribute(
  pots: Pot[],
  scores: Map<number, HandScore>,
  buttonSeat: number,
  seatCount: number,
): Map<number, number> {
  const winnings = new Map<number, number>();
  const order = (seat: number) => (seat - buttonSeat - 1 + seatCount) % seatCount;
  for (const pot of pots) {
    let winners: number[] = [];
    if (pot.eligible.length === 1) {
      winners = pot.eligible;
    } else {
      let best: HandScore | null = null;
      for (const seat of pot.eligible) {
        const sc = scores.get(seat);
        if (!sc) continue;
        const cmp = best ? compareScores(sc, best) : 1;
        if (cmp > 0) { best = sc; winners = [seat]; }
        else if (cmp === 0) winners.push(seat);
      }
    }
    winners.sort((a, b) => order(a) - order(b));
    const share = Math.floor(pot.amount / winners.length);
    let odd = pot.amount - share * winners.length;
    for (const w of winners) {
      const extra = odd > 0 ? 1 : 0;
      odd -= extra;
      winnings.set(w, (winnings.get(w) ?? 0) + share + extra);
    }
  }
  return winnings;
}
