import { evaluate, compareScores } from '../../src/engine/handEvaluator';
import { parseCard } from '../../src/engine/cards';

const h = (s: string) => evaluate(s.split(' ').map(parseCard));
const cmp = (a: string, b: string) => compareScores(h(a), h(b));

describe('handEvaluator categories from 7 cards', () => {
  it.each([
    ['As Kd 9h 7c 4d 3s 2h', 0],
    ['As Ad 9h 7c 4d 3s 2h', 1],
    ['As Ad 9h 9c 4d 3s 2h', 2],
    ['As Ad Ah 7c 4d 3s 2h', 3],
    ['5s 6d 7h 8c 9d Ks 2h', 4],
    ['As Ks 9s 7s 4s 3d 2h', 5],
    ['As Ad Ah 7c 7d 3s 2h', 6],
    ['As Ad Ah Ac 4d 3s 2h', 7],
    ['5s 6s 7s 8s 9s Kd 2h', 8],
  ])('%s is category %i', (cards, cat) => {
    expect(h(cards as string).category).toBe(cat);
  });
});

describe('handEvaluator comparisons', () => {
  it('wheel straight loses to 6-high straight', () => {
    expect(cmp('As 2d 3h 4c 5d Kh 9s', '2s 3d 4h 5c 6d Kh 9s')).toBeLessThan(0);
  });
  it('wheel is a straight', () => {
    expect(h('As 2d 3h 4c 5d Kh 9s').category).toBe(4);
  });
  it('flush beats straight', () => {
    expect(cmp('As Ks 9s 7s 4s 3d 2h', '5s 6d 7h 8c 9d Ks 2h')).toBeGreaterThan(0);
  });
  it('full house compares trips before pair', () => {
    expect(cmp('Ks Kd Kh 2c 2d 3s 4h', 'Qs Qd Qh Ac Ad 3s 4h')).toBeGreaterThan(0);
  });
  it('same pair, higher kicker wins', () => {
    expect(cmp('As Ad Kh 7c 4d 3s 2h', 'Ah Ac Qh 7d 4s 3c 2d')).toBeGreaterThan(0);
  });
  it('board plays gives equal scores', () => {
    expect(cmp('As Ks Qs Js Ts 2d 3h', 'As Ks Qs Js Ts 4d 5h')).toBe(0);
  });
  it('royal flush beats lower straight flush', () => {
    expect(cmp('As Ks Qs Js Ts 2d 3h', '9s 8s 7s 6s 5s 2d 3h')).toBeGreaterThan(0);
  });
  it('two pair uses best two pairs and top kicker', () => {
    expect(cmp('As Ad Kh Kc Qd Qs 2h', 'Ah Ac Kd Ks Jd 3s 2c')).toBeGreaterThan(0);
  });
});
