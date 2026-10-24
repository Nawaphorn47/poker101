import { useState, type ReactNode } from 'react';
import { PotOddsPanel } from './tools/PotOddsPanel';
import { IcmPanel } from './tools/IcmPanel';
import { EquityPanel } from './tools/EquityPanel';
import { ChartPanel } from './tools/ChartPanel';

const TABS: { id: string; title: string; panel: ReactNode }[] = [
  { id: 'pot', title: 'Pot odds', panel: <PotOddsPanel /> },
  { id: 'icm', title: 'ICM', panel: <IcmPanel /> },
  { id: 'equity', title: 'Equity', panel: <EquityPanel /> },
  { id: 'chart', title: 'Push/fold chart', panel: <ChartPanel /> },
];

export function ToolsPage({ onBack }: { onBack: () => void }) {
  const [active, setActive] = useState('pot');
  return (
    <section className="tools">
      <button onClick={onBack}>Back</button>
      <h2>Tools</h2>
      <div role="tablist" className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={active === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setActive(t.id)}
          >
            {t.title}
          </button>
        ))}
      </div>
      {/* every panel stays mounted so inputs survive switching tabs */}
      {TABS.map((t) => (
        <div key={t.id} role="tabpanel" id={`panel-${t.id}`} aria-label={t.title} hidden={active !== t.id}>
          {t.panel}
        </div>
      ))}
    </section>
  );
}
