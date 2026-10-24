import { useState } from 'react';
import { icmEquities } from '../../tools/icm';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 10;
const MAX_PAYOUTS = 5;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function IcmPanel() {
  const [stacks, setStacks] = useState(['5000', '3000', '2000']);
  const [payouts, setPayouts] = useState(['50', '30', '20']);

  const edit = (list: string[], set: (v: string[]) => void, i: number, v: string) =>
    set(list.map((x, k) => (k === i ? v : x)));
  const result = icmEquities(stacks.map(Number), payouts.map(Number));

  return (
    <div className="tool-panel">
      <h3>Stacks</h3>
      {stacks.map((s, i) => (
        <div key={i} className="row">
          <label>
            {`Stack ${i + 1}`}
            <input inputMode="decimal" value={s} onChange={(e) => edit(stacks, setStacks, i, e.target.value)} />
          </label>
          <button
            type="button"
            aria-label={`Remove player ${i + 1}`}
            disabled={stacks.length <= MIN_PLAYERS}
            onClick={() => setStacks(stacks.filter((_, k) => k !== i))}
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" disabled={stacks.length >= MAX_PLAYERS} onClick={() => setStacks([...stacks, '1000'])}>
        Add player
      </button>

      <h3>Payouts by finishing place</h3>
      {payouts.map((p, i) => (
        <div key={i} className="row">
          <label>
            {`Payout ${i + 1}`}
            <input inputMode="decimal" value={p} onChange={(e) => edit(payouts, setPayouts, i, e.target.value)} />
          </label>
          <button
            type="button"
            aria-label={`Remove payout ${i + 1}`}
            disabled={payouts.length <= 1}
            onClick={() => setPayouts(payouts.filter((_, k) => k !== i))}
          >
            Remove
          </button>
        </div>
      ))}
      <button type="button" disabled={payouts.length >= MAX_PAYOUTS} onClick={() => setPayouts([...payouts, '0'])}>
        Add payout
      </button>

      {!result.ok && (
        <div role="alert" className="warning">
          {result.error}
        </div>
      )}
      {result.ok && (
        <div className="result-box">
          <span className="tag">Model</span>
          <p className="note">Malmuth-Harville ICM: it ignores skill and blind pressure.</p>
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Chips</th>
                <th>Prize value</th>
                <th>Share of prize pool</th>
              </tr>
            </thead>
            <tbody>
              {result.values.map((v, i) => (
                <tr key={i} data-testid="icm-row">
                  <td>{`Player ${i + 1}`}</td>
                  <td>{pct(result.chipShares[i])}</td>
                  <td>{v.toFixed(2)}</td>
                  <td>{pct(result.shares[i])}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
