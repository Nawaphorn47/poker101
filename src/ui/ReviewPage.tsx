import { useEffect, useState } from 'react';
import { listHands } from '../store/db';
import { reviewHand, type ReviewItem } from '../coach/review';
import type { HandLog } from '../engine/handLog';
import type { Action } from '../engine/types';

const pct = (x: number) => `${Math.round(x * 100)}%`;

function describe(a: Action): string {
  if (a.type === 'bet') return `bets ${a.amount}`;
  if (a.type === 'raise') return `raises to ${a.amount}`;
  return a.type === 'fold' ? 'folds' : a.type === 'check' ? 'checks' : 'calls';
}

export function ReviewPage({ handId, onBack }: { handId: string; onBack: () => void }) {
  const [log, setLog] = useState<HandLog | null | undefined>(undefined);
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [upTo, setUpTo] = useState(0);

  useEffect(() => {
    listHands().then((all) => {
      const found = all.find((h) => h.id === handId) ?? null;
      setLog(found);
      if (found) {
        setItems(reviewHand(found));
        setUpTo(found.actions.length);
      }
    });
  }, [handId]);

  if (log === undefined) return <p>Loading…</p>;
  if (log === null)
    return (
      <section>
        <button onClick={onBack}>Back</button>
        <p>Hand not found.</p>
      </section>
    );

  const who = (seat: number) => (log.seats[seat].id === 0 ? 'You' : `Bot ${log.seats[seat].id}`);
  return (
    <section className="review">
      <button onClick={onBack}>Back</button>
      <h2>Hand review</h2>
      <p className="note">
        Suggestions use equity and pot odds. This review is not a GTO solver, so treat flags as advice, not verdicts.
      </p>
      <div>
        <button disabled={upTo <= 1} onClick={() => setUpTo(upTo - 1)}>
          Previous
        </button>
        <button disabled={upTo >= log.actions.length} onClick={() => setUpTo(upTo + 1)}>
          Next
        </button>
      </div>
      <ol>
        {log.actions.slice(0, upTo).map((entry, step) => {
          const item = items.find((i) => i.step === step);
          return (
            <li key={step} data-testid="review-step" data-flag={item?.flag}>
              <span>
                {who(entry.seat)} {describe(entry.action)}
              </span>
              {item && <span className="equity"> (equity {pct(item.equity)})</span>}
              {item && item.flag === 'questionable' && <span className="reason"> {item.reason}</span>}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
