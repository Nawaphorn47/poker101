export type Suit = 'c' | 'd' | 'h' | 's';
export type Card = { rank: number; suit: Suit };

const RANKS = '23456789TJQKA';

export function cardToString(c: Card): string {
  return RANKS[c.rank - 2] + c.suit;
}

export function parseCard(s: string): Card {
  const rank = RANKS.indexOf(s[0]) + 2;
  if (rank < 2 || !'cdhs'.includes(s[1])) throw new Error(`bad card: ${s}`);
  return { rank, suit: s[1] as Suit };
}
