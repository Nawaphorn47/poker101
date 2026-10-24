import { render, screen, fireEvent, act } from '@testing-library/react';
import { EquityPanel } from '../../src/ui/tools/EquityPanel';
import type { EquityInput, EquityResult } from '../../src/tools/equity';
import type { RunHandle } from '../../src/tools/equityRunner';

type Update = (r: EquityResult, done: boolean, note?: string) => void;
type Call = { input: EquityInput; onUpdate: Update; handle: { stop: ReturnType<typeof vi.fn> } };

function fakeRun() {
  const calls: Call[] = [];
  const run = (input: EquityInput, onUpdate: Update): RunHandle => {
    const handle = { stop: vi.fn() };
    calls.push({ input, onUpdate, handle });
    return handle;
  };
  return { calls, run };
}

const exact = (a: number): EquityResult => ({
  ok: true, exact: true, samples: 990,
  players: [{ win: a, tie: 0, equity: a }, { win: 1 - a, tie: 0, equity: 1 - a }],
});
const simulated = (a: number): EquityResult => ({
  ok: true, exact: false, samples: 20000, margin: [0.0056, 0.0056],
  players: [{ win: a, tie: 0, equity: a }, { win: 1 - a, tie: 0, equity: 1 - a }],
});

const pick = (label: string, card: string) => {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}:`) }));
  fireEvent.click(screen.getByRole('button', { name: card }));
};
const fillHands = () => {
  pick('Player 1 card 1', 'As');
  pick('Player 1 card 2', 'Ah');
  pick('Player 2 card 1', 'Ks');
  pick('Player 2 card 2', 'Qs');
};
const fillFlop = () => {
  pick('Board card 1', '2s');
  pick('Board card 2', '7s');
  pick('Board card 3', '9h');
};

describe('EquityPanel', () => {
  it('a valid flop runs the calculation and shows the exact equities', () => {
    const { calls, run } = fakeRun();
    render(<EquityPanel run={run} />);
    fillHands();
    fillFlop();
    const last = calls[calls.length - 1];
    expect(last.input.board).toHaveLength(3);
    expect(last.input.hands).toHaveLength(2);
    act(() => last.onUpdate(exact(0.75), true));
    expect(screen.getByText('Exact')).toBeTruthy();
    const rows = screen.getAllByTestId('equity-row');
    expect(rows[0].textContent).toContain('75.0%');
    expect(rows[1].textContent).toContain('25.0%');
  });

  it('an incomplete hand shows the pick-both-cards message and never calls run', () => {
    const { calls, run } = fakeRun();
    render(<EquityPanel run={run} />);
    pick('Player 1 card 1', 'As');
    pick('Player 1 card 2', 'Ah');
    pick('Player 2 card 1', 'Ks');
    expect(screen.getByText('Pick both cards for every player.')).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it('a board of 2 cards shows the board message and stops the earlier run', () => {
    const { calls, run } = fakeRun();
    render(<EquityPanel run={run} />);
    fillHands();
    const before = calls.length;
    expect(before).toBeGreaterThan(0);
    pick('Board card 1', '2s');
    pick('Board card 2', '7s');
    expect(screen.getByText('The board needs 0, 3, 4 or 5 cards.')).toBeTruthy();
    expect(calls[calls.length - 1].handle.stop).toHaveBeenCalled();
    expect(calls).toHaveLength(before);
  });

  it('a card already chosen cannot be chosen again', () => {
    const { run } = fakeRun();
    render(<EquityPanel run={run} />);
    pick('Player 1 card 1', 'As');
    fireEvent.click(screen.getByRole('button', { name: /^Player 2 card 1:/ }));
    expect((screen.getByRole('button', { name: 'As' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('changing a card stops the previous run and a late update from it is never shown', () => {
    const { calls, run } = fakeRun();
    render(<EquityPanel run={run} />);
    fillHands();
    const old = calls[calls.length - 1];
    pick('Player 1 card 1', 'Kd');
    expect(old.handle.stop).toHaveBeenCalled();
    const fresh = calls[calls.length - 1];
    expect(fresh).not.toBe(old);
    act(() => old.onUpdate(exact(0.99), true));
    expect(screen.queryAllByTestId('equity-row')).toHaveLength(0);
    act(() => fresh.onUpdate(exact(0.4), true));
    expect(screen.getAllByTestId('equity-row')[0].textContent).toContain('40.0%');
    expect(screen.getAllByTestId('equity-row')[0].textContent).not.toContain('99.0%');
  });

  it('a simulated update shows the Estimate badge with its margin, and Stop stops the run', () => {
    const { calls, run } = fakeRun();
    render(<EquityPanel run={run} />);
    fillHands();
    const last = calls[calls.length - 1];
    act(() => last.onUpdate(simulated(0.7), false));
    expect(screen.getByText('Estimate ±0.6%')).toBeTruthy();
    expect(screen.getByText(/20,?000 samples/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(last.handle.stop).toHaveBeenCalled();
  });

  it('shows the fallback note when the run supplies one', () => {
    const { calls, run } = fakeRun();
    render(<EquityPanel run={run} />);
    fillHands();
    act(() => calls[calls.length - 1].onUpdate(simulated(0.7), false, 'Simulated on the main thread with fewer samples.'));
    expect(screen.getByText('Simulated on the main thread with fewer samples.')).toBeTruthy();
  });

  it('an error from the run is shown as an alert', () => {
    const { calls, run } = fakeRun();
    render(<EquityPanel run={run} />);
    fillHands();
    act(() => calls[calls.length - 1].onUpdate({ ok: false, error: 'Something is wrong.' }, true));
    expect(screen.getByRole('alert').textContent).toContain('Something is wrong.');
  });

  it('players can be added up to 6 and removed down to 2', () => {
    const { run } = fakeRun();
    render(<EquityPanel run={run} />);
    for (let i = 0; i < 6; i++) {
      const add = screen.getByRole('button', { name: 'Add player' }) as HTMLButtonElement;
      if (!add.disabled) fireEvent.click(add);
    }
    expect(screen.getAllByRole('button', { name: /^Player \d card 1:/ })).toHaveLength(6);
    expect((screen.getByRole('button', { name: 'Add player' }) as HTMLButtonElement).disabled).toBe(true);
    for (let i = 0; i < 6; i++) {
      const rm = screen.queryAllByRole('button', { name: /^Remove player/ }).find((b) => !(b as HTMLButtonElement).disabled);
      if (rm) fireEvent.click(rm);
    }
    expect(screen.getAllByRole('button', { name: /^Player \d card 1:/ })).toHaveLength(2);
  });
});
