import { useMemo, useState } from 'react';
import { chartFor, type ChartCell } from '../../tools/chart';

const SIZE = 13;

export function ChartPanel() {
  const [stack, setStack] = useState(10);
  const [role, setRole] = useState<'sb' | 'bb'>('sb');
  const [selected, setSelected] = useState<string | null>(null);

  const chart = useMemo(() => chartFor(stack, role), [stack, role]);
  const grid = useMemo(() => {
    const rows: ChartCell[][] = Array.from({ length: SIZE }, () => new Array<ChartCell>(SIZE));
    for (const c of chart.cells) rows[c.row][c.col] = c;
    return rows.flat();
  }, [chart]);
  const detail = selected ? chart.cells.find((c) => c.name === selected) : undefined;

  return (
    <div className="tool-panel">
      <div className="row">
        <button type="button" aria-pressed={role === 'sb'} onClick={() => setRole('sb')}>
          SB pushes
        </button>
        <button type="button" aria-pressed={role === 'bb'} onClick={() => setRole('bb')}>
          BB calls
        </button>
      </div>
      <label>
        Stack (bb)
        <input type="range" min={2} max={15} step={1} value={stack} onChange={(e) => setStack(Number(e.target.value))} />
        <output> {stack}bb</output>
      </label>
      <p data-testid="chart-pct">{chart.pct.toFixed(1)}% of combinations</p>

      <div className="chart-grid">
        {grid.map((c) => (
          <button
            type="button"
            key={c.name}
            data-name={c.name}
            aria-label={`${c.name} ${c.action}`}
            className={`${c.action}${c.borderline ? ' borderline' : ''}${selected === c.name ? ' selected' : ''}`}
            onClick={() => setSelected(c.name)}
            onMouseEnter={() => setSelected(c.name)}
          >
            {c.name}
          </button>
        ))}
      </div>

      <p data-testid="cell-detail" className="note">
        {detail
          ? `${detail.name}: EV ${detail.ev.toFixed(2)} bb vs fold ${detail.foldEv.toFixed(2)} bb, best: ${detail.action}${detail.borderline ? ' (borderline)' : ''}`
          : 'Select a hand to see its EV.'}
      </p>
      <p className="note">
        Green is {role === 'sb' ? 'push' : 'call'}, grey is fold, dashed border means the two choices are within 0.1bb.
        Heads-up only, about ±1% simulation error, and it ignores card removal.
      </p>
    </div>
  );
}
