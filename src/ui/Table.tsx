import { useEffect, useReducer, useRef } from 'react';
import type { Session } from '../session/session';
import { CardView } from './CardView';
import { ActionBar } from './ActionBar';
import { HintPanel } from './HintPanel';

export function Table({ session, onExit }: { session: Session; onExit: () => void }) {
  const [tick, bump] = useReducer((n: number) => n + 1, 0);
  const running = useRef(false);

  useEffect(() => session.onChange(bump), [session]);
  useEffect(() => {
    if (running.current) return;
    running.current = true;
    // session.onChange already re-renders on every action; bumping here would re-trigger this effect forever
    session.runBotsUntilHuman().finally(() => {
      running.current = false;
    });
  }, [session, tick]);

  const st = session.state();
  const done = st.street === 'done';
  const reveal = done && st.result?.showdown;
  const humanIdx = session.humanSeat();
  const label = (i: number) => (st.cfg.seats[i].id === 0 ? 'You' : `Bot ${st.cfg.seats[i].id}`);
  const pot = st.seats.reduce((a, s) => a + s.totalCommitted, 0);
  const legal = session.humanLegal();
  const warning = session.warning();

  return (
    <section className="table">
      {warning && (
        <div role="alert" className="warning">
          {warning}
        </div>
      )}
      <header>
        <strong>{session.mode === 'cash' ? 'Cash game' : 'Tournament'}</strong>
        <span>
          {' '}
          Blinds {st.cfg.smallBlind}/{st.cfg.bigBlind}
        </span>
        <button
          onClick={async () => {
            await session.leave();
            onExit();
          }}
        >
          {session.mode === 'cash' ? 'Leave table' : 'Quit'}
        </button>
      </header>
      <div className="board" aria-label="board">
        {st.board.map((c, i) => (
          <CardView key={i} card={c} />
        ))}
        <span className="pot">Pot {pot}</span>
      </div>
      <div className="seats">
        {st.seats.map((s, i) => (
          <div
            key={i}
            data-testid="seat"
            className={`seat${s.folded ? ' folded' : ''}${st.round.toAct === i ? ' acting' : ''}`}
          >
            <div>
              {label(i)}
              {i === st.button ? ' (D)' : ''}
            </div>
            <div className="cards">
              {s.hole.map((c, k) => (
                <CardView key={k} card={c} hidden={i !== humanIdx && !(reveal && !s.folded)} />
              ))}
            </div>
            <div>
              {s.stack}
              {s.committed > 0 ? ` · bet ${s.committed}` : ''}
              {s.allIn ? ' · all-in' : ''}
            </div>
          </div>
        ))}
      </div>
      {done && (
        <div className="result" role="status">
          {Object.entries(st.result!.winnings).map(([i, amt]) => (
            <div key={i}>
              {label(Number(i))} won {amt}
            </div>
          ))}
          {session.isOver() ? (
            <button onClick={onExit}>Finish</button>
          ) : (
            <button onClick={() => session.nextHand()}>Next hand</button>
          )}
        </div>
      )}
      {!done && legal && (
        <>
          <ActionBar
            legal={legal}
            currentBet={st.round.currentBet}
            onAction={(a) => {
              session.submitHuman(a);
            }}
          />
          <HintPanel session={session} tick={tick} />
        </>
      )}
    </section>
  );
}
