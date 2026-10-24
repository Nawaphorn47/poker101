import type { HandLog } from '../engine/handLog';

export function HandList({ hands, onReview }: { hands: HandLog[]; onReview: (id: string) => void }) {
  if (hands.length === 0) return <p>No hands played yet.</p>;
  return (
    <ul className="hand-list">
      {hands.map((h, i) => (
        <li key={h.id}>
          <span>Hand {i + 1}</span>
          <span>{h.mode === 'cash' ? 'Cash' : 'Tournament'}</span>
          <span>{h.netBb >= 0 ? '+' : ''}{h.netBb.toFixed(1)} bb</span>
          {h.usedHint && <span className="tag">Hint used</span>}
          <button aria-label={`Review hand ${i + 1}`} onClick={() => onReview(h.id)}>
            Review
          </button>
        </li>
      ))}
    </ul>
  );
}
