import { useState } from 'react';
import type { Card, Suit } from '../engine/cards';
import { cardToString } from '../engine/cards';

const SUITS: Suit[] = ['s', 'h', 'd', 'c'];
const SYMBOL: Record<Suit, string> = { c: '♣', d: '♦', h: '♥', s: '♠' };
const RANKS = [14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2];

const key = (c: Card) => cardToString(c);
const face = (c: Card) => `${key(c)[0] === 'T' ? '10' : key(c)[0]}${SYMBOL[c.suit]}`;

/** A slot that opens a 52-card grid. Cards in `used` (other than the slot's own) are disabled. */
export function CardPicker({
  label,
  value,
  used,
  onChange,
}: {
  label: string;
  value: Card | null;
  used: Card[];
  onChange: (card: Card | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const taken = new Set(used.map(key));
  if (value) taken.delete(key(value));

  const choose = (card: Card | null) => {
    onChange(card);
    setOpen(false);
  };

  return (
    <span className="card-picker">
      <button
        type="button"
        className={`slot${value ? ' filled' : ''}${value && (value.suit === 'd' || value.suit === 'h') ? ' red' : ''}`}
        aria-label={`${label}: ${value ? key(value) : 'empty'}`}
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        {value ? face(value) : '+'}
      </button>
      {open && (
        <div role="dialog" aria-label="Choose a card" className="card-grid">
          {SUITS.map((suit) => (
            <div key={suit} className="card-row">
              {RANKS.map((rank) => {
                const card = { rank, suit };
                return (
                  <button
                    type="button"
                    key={key(card)}
                    data-card={key(card)}
                    aria-label={key(card)}
                    className={suit === 'd' || suit === 'h' ? 'red' : undefined}
                    disabled={taken.has(key(card))}
                    onClick={() => choose(card)}
                  >
                    {face(card)}
                  </button>
                );
              })}
            </div>
          ))}
          {value && (
            <button type="button" onClick={() => choose(null)}>
              Clear
            </button>
          )}
        </div>
      )}
    </span>
  );
}
