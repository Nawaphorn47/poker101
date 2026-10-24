import { useState } from 'react';
import { potOddsReport } from '../../tools/potOdds';

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const chips = (x: number) => `${x >= 0 ? '+' : ''}${x.toFixed(2)} chips`;

export function PotOddsPanel() {
  const [pot, setPot] = useState('');
  const [bet, setBet] = useState('');
  const [outs, setOuts] = useState('');
  const [street, setStreet] = useState<'flop' | 'turn' | 'river'>('flop');

  const complete = pot.trim() !== '' && bet.trim() !== '' && outs.trim() !== '';
  const report = complete ? potOddsReport({ potBefore: Number(pot), bet: Number(bet), outs: Number(outs), street }) : null;

  return (
    <div className="tool-panel">
      <label>
        Pot before the bet
        <input inputMode="decimal" value={pot} onChange={(e) => setPot(e.target.value)} />
      </label>
      <label>
        Bet
        <input inputMode="decimal" value={bet} onChange={(e) => setBet(e.target.value)} />
      </label>
      <label>
        Outs
        <input inputMode="numeric" value={outs} onChange={(e) => setOuts(e.target.value)} />
      </label>
      <label>
        Street
        <select value={street} onChange={(e) => setStreet(e.target.value as typeof street)}>
          <option value="flop">Flop</option>
          <option value="turn">Turn</option>
          <option value="river">River</option>
        </select>
      </label>

      {!complete && <p className="note">Enter the pot, the bet and your outs.</p>}
      {report && !report.ok && (
        <div role="alert" className="warning">
          {report.error}
        </div>
      )}
      {report && report.ok && (
        <div className="result-box">
          <span className="tag">Exact</span>
          <p>
            Pot after the bet {report.potAfter}. Equity needed to call:{' '}
            <strong data-testid="required-equity">{pct(report.requiredEquity)}</strong>
          </p>
          {report.nextCard && (
            <p>
              Counting only the next card: equity {pct(report.nextCard.equity)}, EV of calling {chips(report.nextCard.ev)}.
            </p>
          )}
          {report.byRiver && (
            <p>
              By the river (only if no more bets follow): equity {pct(report.byRiver.equity)}, EV of calling{' '}
              {chips(report.byRiver.ev)}.
            </p>
          )}
          {report.verdict && (
            <p data-testid="verdict">
              <strong>{report.verdict === 'call' ? 'Call' : 'Fold'}</strong> on next-card odds.
            </p>
          )}
          {report.disagreement && (
            <p className="note">The two bases disagree: the call is only worthwhile if no more bets follow.</p>
          )}
        </div>
      )}
    </div>
  );
}
