import { requiredEquity, outsEquity, ruleOfEstimate, evCall } from '../../src/drill/oddsMath';

describe('oddsMath', () => {
  it('requiredEquity(50, 150) is 0.25', () => {
    expect(requiredEquity(50, 150)).toBe(0.25);
  });
  it('a bet larger than the pot needs more than 50%', () => {
    expect(requiredEquity(200, 100)).toBeGreaterThan(0.5);
  });
  it('9 outs on the flop is about 35.0% by the river', () => {
    expect(outsEquity(9, 'flop')).toBeCloseTo(0.3497, 3);
  });
  it('9 outs on the turn is about 19.6%', () => {
    expect(outsEquity(9, 'turn')).toBeCloseTo(0.1957, 3);
  });
  it('0 outs is 0 and 1 out on the turn is 1/46', () => {
    expect(outsEquity(0, 'flop')).toBe(0);
    expect(outsEquity(1, 'turn')).toBeCloseTo(1 / 46, 10);
  });
  it('rule of 4 on the flop and rule of 2 on the turn', () => {
    expect(ruleOfEstimate(9, 'flop')).toBeCloseTo(0.36, 10);
    expect(ruleOfEstimate(9, 'turn')).toBeCloseTo(0.18, 10);
  });
  it('evCall is zero at break-even equity', () => {
    expect(evCall(0.25, 150, 50)).toBeCloseTo(0, 10);
  });
  it('evCall(0.4, 100, 50) is 25 chips', () => {
    expect(evCall(0.4, 100, 50)).toBeCloseTo(0.4 * 100 - 0.6 * 50, 10);
  });
});
