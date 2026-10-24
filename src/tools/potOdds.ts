import { evCall, nextCardEquity, outsEquity, requiredEquity } from '../drill/oddsMath';

export type PotOddsInput = {
  /** pot before the opponent's bet */
  potBefore: number;
  bet: number;
  outs: number;
  street: 'flop' | 'turn' | 'river';
};

type Basis = { equity: number; ev: number };

export type PotOddsReport =
  | {
      ok: true;
      potAfter: number;
      requiredEquity: number;
      /** equity and EV counting only the next card */
      nextCard?: Basis;
      /** flop only: equity and EV counting both cards to come (valid only if no more bets follow) */
      byRiver?: Basis;
      verdict: 'call' | 'fold' | null;
      /** the next-card and by-river bases give opposite verdicts */
      disagreement: boolean;
    }
  | { ok: false; error: string };

export function potOddsReport(input: PotOddsInput): PotOddsReport {
  const { potBefore, bet, outs, street } = input;
  if (!Number.isFinite(potBefore) || potBefore < 0) return { ok: false, error: 'The pot must be a number of 0 or more.' };
  if (!Number.isFinite(bet) || bet <= 0) return { ok: false, error: 'The bet must be greater than 0.' };
  if (!Number.isInteger(outs) || outs < 0 || outs > 20) return { ok: false, error: 'Outs must be a whole number from 0 to 20.' };

  const potAfter = potBefore + bet;
  if (!Number.isFinite(potAfter + bet)) return { ok: false, error: 'These numbers are too large to calculate.' };
  const required = requiredEquity(bet, potAfter);
  if (street === 'river') return { ok: true, potAfter, requiredEquity: required, verdict: null, disagreement: false };

  const nextEq = nextCardEquity(outs, street);
  const nextCard: Basis = { equity: nextEq, ev: evCall(nextEq, potAfter, bet) };
  let byRiver: Basis | undefined;
  if (street === 'flop') {
    const eq = outsEquity(outs, 'flop');
    byRiver = { equity: eq, ev: evCall(eq, potAfter, bet) };
  }
  return {
    ok: true,
    potAfter,
    requiredEquity: required,
    nextCard,
    byRiver,
    verdict: nextCard.ev > 0 ? 'call' : 'fold',
    disagreement: byRiver !== undefined && nextCard.ev > 0 !== byRiver.ev > 0,
  };
}
