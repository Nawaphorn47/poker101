import type { Card } from '../engine/cards';
import { cardToString } from '../engine/cards';

const SUIT: Record<string, string> = { c: '♣', d: '♦', h: '♥', s: '♠' };

export function CardView({ card, hidden }: { card?: Card; hidden?: boolean }) {
  if (!card || hidden) return <span className="card back" aria-label="hidden card" />;
  const red = card.suit === 'd' || card.suit === 'h';
  const rank = cardToString(card)[0];
  return (
    <span className={`card${red ? ' red' : ''}`} aria-label={cardToString(card)}>
      {rank === 'T' ? '10' : rank}
      {SUIT[card.suit]}
    </span>
  );
}
