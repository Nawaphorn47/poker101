import { handClass, chenScore, ALL_CLASSES } from '../../src/engine/handClass';
import { parseCard } from '../../src/engine/cards';

const hc = (s: string) => s.split(' ').map(parseCard);

describe('handClass', () => {
  it('names pairs, suited and offsuit hands high card first', () => {
    expect(handClass(hc('As Ad'))).toBe('AA');
    expect(handClass(hc('Kh As'))).toBe('AKo');
    expect(handClass(hc('Td 9d'))).toBe('T9s');
  });
  it('has 169 distinct classes', () => {
    expect(new Set(ALL_CLASSES.map((c) => c.name)).size).toBe(169);
  });
  it('chen scores follow the known formula', () => {
    expect(chenScore(hc('As Ad'))).toBe(20);
    expect(chenScore(hc('As Ks'))).toBe(12);
    expect(chenScore(hc('7c 2d'))).toBeLessThan(0);
  });
});
