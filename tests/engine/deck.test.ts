import { shuffledDeck } from '../../src/engine/deck';
import { cardToString, parseCard } from '../../src/engine/cards';

describe('deck', () => {
  it('has 52 unique cards', () => {
    const d = shuffledDeck(1);
    expect(d).toHaveLength(52);
    expect(new Set(d.map(cardToString)).size).toBe(52);
  });
  it('same seed gives identical order', () => {
    expect(shuffledDeck(42)).toEqual(shuffledDeck(42));
  });
  it('different seeds differ', () => {
    expect(shuffledDeck(1).map(cardToString)).not.toEqual(shuffledDeck(2).map(cardToString));
  });
  it('parseCard(cardToString(c)) equals c for all 52', () => {
    for (const c of shuffledDeck(7)) expect(parseCard(cardToString(c))).toEqual(c);
  });
  it('formats As correctly', () => {
    expect(cardToString({ rank: 14, suit: 's' })).toBe('As');
  });
});
