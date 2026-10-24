import { useEffect, useState } from 'react';
import type { Action, LegalActions } from '../engine/types';

export function ActionBar({
  legal,
  currentBet,
  onAction,
}: {
  legal: LegalActions;
  currentBet: number;
  onAction: (a: Action) => void;
}) {
  const [raiseTo, setRaiseTo] = useState(legal.minRaiseTo);
  useEffect(() => setRaiseTo(legal.minRaiseTo), [legal.minRaiseTo, legal.maxRaiseTo]);
  const clamped = Math.max(legal.minRaiseTo, Math.min(raiseTo, legal.maxRaiseTo));
  return (
    <div className="actions">
      <button onClick={() => onAction({ type: 'fold' })}>Fold</button>
      {legal.canCheck ? (
        <button onClick={() => onAction({ type: 'check' })}>Check</button>
      ) : (
        <button onClick={() => onAction({ type: 'call' })}>Call {legal.callAmount}</button>
      )}
      {legal.canRaise && (
        <span className="raise">
          <input
            type="range"
            aria-label="raise amount"
            min={legal.minRaiseTo}
            max={legal.maxRaiseTo}
            value={clamped}
            onChange={(e) => setRaiseTo(Number(e.target.value))}
          />
          <button onClick={() => onAction({ type: currentBet === 0 ? 'bet' : 'raise', amount: clamped })}>
            {currentBet === 0 ? 'Bet' : 'Raise to'} {clamped}
            {clamped === legal.maxRaiseTo ? ' (all-in)' : ''}
          </button>
        </span>
      )}
    </div>
  );
}
