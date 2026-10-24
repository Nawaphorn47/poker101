import { useEffect, useRef, useState } from 'react';
import type { Card } from '../../engine/cards';
import { cardToString } from '../../engine/cards';
import { validateEquityInput, type EquityResult } from '../../tools/equity';
import { startEquity, type RunHandle } from '../../tools/equityRunner';
import { CardPicker } from '../CardPicker';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;
const BOARD_SLOTS = 5;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

type Outcome = { result: EquityResult; done: boolean; note?: string };
type Run = typeof startEquity;

export function EquityPanel({ run = startEquity }: { run?: Run }) {
  const [players, setPlayers] = useState<(Card | null)[][]>([[null, null], [null, null]]);
  const [board, setBoard] = useState<(Card | null)[]>(Array(BOARD_SLOTS).fill(null));
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [stopped, setStopped] = useState(false);
  const handle = useRef<RunHandle | null>(null);
  const runId = useRef(0);

  const filled = (cards: (Card | null)[]) => cards.filter((c): c is Card => c !== null);
  const hands = players.map(filled);
  const boardCards = filled(board);
  const used = [...hands.flat(), ...boardCards];
  const message = validateEquityInput({ hands, board: boardCards });
  const inputKey = JSON.stringify([hands.map((h) => h.map(cardToString)), boardCards.map(cardToString)]);

  useEffect(() => {
    setOutcome(null);
    setStopped(false);
    if (message) return;
    const id = ++runId.current;
    const h = run({ hands, board: boardCards }, (result, done, note) => {
      if (id === runId.current) setOutcome({ result, done, note });
    });
    handle.current = h;
    return () => {
      runId.current++; // anything this run delivers from now on is stale
      h.stop();
    };
    // the run restarts only when the cards change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputKey]);

  const setPlayerCard = (p: number, k: number, card: Card | null) =>
    setPlayers(players.map((cards, i) => (i === p ? cards.map((c, j) => (j === k ? card : c)) : cards)));

  const result = outcome?.result;
  const maxMargin = result && result.ok && result.margin ? Math.max(...result.margin) : 0;

  return (
    <div className="tool-panel">
      {players.map((cards, p) => (
        <div key={p} className="row">
          <span className="who">{`Player ${p + 1}`}</span>
          {cards.map((c, k) => (
            <CardPicker key={k} label={`Player ${p + 1} card ${k + 1}`} value={c} used={used} onChange={(card) => setPlayerCard(p, k, card)} />
          ))}
          <button
            type="button"
            aria-label={`Remove player ${p + 1}`}
            disabled={players.length <= MIN_PLAYERS}
            onClick={() => setPlayers(players.filter((_, i) => i !== p))}
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" disabled={players.length >= MAX_PLAYERS} onClick={() => setPlayers([...players, [null, null]])}>
        Add player
      </button>

      <div className="row">
        <span className="who">Board</span>
        {board.map((c, k) => (
          <CardPicker
            key={k}
            label={`Board card ${k + 1}`}
            value={c}
            used={used}
            onChange={(card) => setBoard(board.map((x, i) => (i === k ? card : x)))}
          />
        ))}
      </div>

      {message && <p className="note">{message}</p>}
      {!message && !outcome && <p className="note">Calculating…</p>}
      {result && !result.ok && (
        <div role="alert" className="warning">
          {result.error}
        </div>
      )}
      {result && result.ok && (
        <div className="result-box">
          <span className="tag">{result.exact ? 'Exact' : `Estimate ±${(maxMargin * 100).toFixed(1)}%`}</span>
          <p className="note">
            {outcome!.done || stopped ? '' : 'Running: '}
            {result.samples.toLocaleString('en-US')} {result.exact ? 'boards counted' : 'samples'}
            {stopped ? ' (stopped)' : ''}
          </p>
          {outcome?.note && <p className="note">{outcome.note}</p>}
          {!outcome!.done && !stopped && (
            <button
              type="button"
              onClick={() => {
                handle.current?.stop();
                setStopped(true);
              }}
            >
              Stop
            </button>
          )}
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Win</th>
                <th>Tie</th>
                <th>Equity</th>
              </tr>
            </thead>
            <tbody>
              {result.players.map((pl, i) => (
                <tr key={i} data-testid="equity-row">
                  <td>{`Player ${i + 1}`}</td>
                  <td>{pct(pl.win)}</td>
                  <td>{pct(pl.tie)}</td>
                  <td>{pct(pl.equity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
