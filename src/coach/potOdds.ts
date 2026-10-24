/** Fraction of equity needed for a call to break even. */
export function potOdds(callAmount: number, pot: number): number {
  if (callAmount <= 0) return 0;
  return callAmount / (pot + callAmount);
}
