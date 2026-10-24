import { useState } from 'react';

// Temporary placeholder; replaced by the real panel in the next task.
export function PotOddsPanel() {
  const [pot, setPot] = useState('');
  return (
    <div>
      <label>
        Pot before the bet
        <input value={pot} onChange={(e) => setPot(e.target.value)} />
      </label>
    </div>
  );
}
