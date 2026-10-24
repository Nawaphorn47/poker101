import { useEffect, useState } from 'react';
import { hint as buildHint } from '../coach/hint';
import { requestEquity } from '../coach/equityClient';
import type { Session } from '../session/session';

export function HintPanel({ session, tick }: { session: Session; tick: number }) {
  const [on, setOn] = useState(false);
  const [text, setText] = useState('Calculating…');
  const view = session.view();
  const legal = session.humanLegal();

  useEffect(() => {
    if (!on || !view || !legal) return;
    let cancelled = false;
    setText('Calculating…');
    const opponents = view.seats.filter((s) => !s.folded && s.id !== view.seat).length;
    requestEquity(view.hole, view.board, Math.max(1, opponents)).then((eq) => {
      if (!cancelled) setText(buildHint(view, legal, eq).text);
    });
    return () => {
      cancelled = true;
    };
    // recompute when the situation changes, not on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on, tick, view?.board.length, legal?.callAmount]);

  return (
    <div className="hint">
      <button
        onClick={() => {
          if (!on) session.markHintUsed();
          setOn(!on);
        }}
      >
        {on ? 'Hide hint' : 'Hint'}
      </button>
      {on && <p role="status">{legal ? text : 'Hints appear when it is your turn.'}</p>}
    </div>
  );
}
