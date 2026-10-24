import { useCallback, useEffect, useState } from 'react';
import { listHands } from '../store/db';
import { computeStats } from '../store/stats';
import { exportBackup, importBackup } from '../store/backup';
import type { HandLog } from '../engine/handLog';
import { HandList } from './HandList';

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function StatsPage({ onBack, onReview }: { onBack: () => void; onReview: (id: string) => void }) {
  const [hands, setHands] = useState<HandLog[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listHands().then(setHands).catch(() => setError('Could not read saved hands.'));
  }, []);
  useEffect(load, [load]);

  const stats = computeStats(hands ?? []);

  async function download() {
    const blob = new Blob([await exportBackup()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'poker-trainer-backup.json';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const r = await importBackup(String(reader.result));
      if (r.ok) {
        setError(null);
        load();
      } else {
        setError(r.error ?? 'Import failed.');
      }
    };
    reader.readAsText(file);
  }

  return (
    <section className="stats">
      <button onClick={onBack}>Back</button>
      <h2>Stats</h2>
      <dl>
        <dt>Hands</dt>
        <dd data-testid="stat-hands">{stats.hands}</dd>
        <dt>VPIP</dt>
        <dd data-testid="stat-vpip">{pct(stats.vpip)}</dd>
        <dt>PFR</dt>
        <dd data-testid="stat-pfr">{pct(stats.pfr)}</dd>
        <dt>bb/100</dt>
        <dd data-testid="stat-bb100">{stats.bbPer100.toFixed(1)}</dd>
        <dt>Showdown win rate</dt>
        <dd data-testid="stat-showdown">{pct(stats.showdownWinRate)}</dd>
      </dl>
      <div className="backup">
        <button onClick={download}>Export backup</button>
        <label>
          Import backup
          <input type="file" accept="application/json" onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </div>
      {error && (
        <div role="alert" className="warning">
          {error}
        </div>
      )}
      <h2>History</h2>
      <HandList hands={hands ?? []} onReview={onReview} />
      <p className="note">History is stored only in this browser. Export a backup before clearing browser data.</p>
    </section>
  );
}
