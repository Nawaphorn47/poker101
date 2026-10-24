import { render, screen, fireEvent } from '@testing-library/react';
import { PotOddsPanel } from '../../src/ui/tools/PotOddsPanel';
import { IcmPanel } from '../../src/ui/tools/IcmPanel';
import { icmEquities } from '../../src/tools/icm';

const type = (label: string, value: string) =>
  fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe('PotOddsPanel', () => {
  it('shows required equity 33.3% and the no-more-bets note for pot 100, bet 100, 9 outs on the flop', () => {
    render(<PotOddsPanel />);
    type('Pot before the bet', '100');
    type('Bet', '100');
    type('Outs', '9');
    expect(screen.getByTestId('required-equity').textContent).toBe('33.3%');
    expect(screen.getByText(/only worthwhile if no more bets follow/i)).toBeTruthy();
    expect(screen.getByTestId('verdict').textContent).toMatch(/fold/i);
  });

  it('shows the Exact badge with a valid result', () => {
    render(<PotOddsPanel />);
    type('Pot before the bet', '100');
    type('Bet', '25');
    type('Outs', '9');
    fireEvent.change(screen.getByLabelText('Street'), { target: { value: 'turn' } });
    expect(screen.getByText('Exact')).toBeTruthy();
    expect(screen.getByTestId('verdict').textContent).toMatch(/call/i);
    expect(screen.queryByText(/By the river/)).toBeNull();
  });

  it('shows only the required equity on the river', () => {
    render(<PotOddsPanel />);
    type('Pot before the bet', '100');
    type('Bet', '50');
    type('Outs', '3');
    fireEvent.change(screen.getByLabelText('Street'), { target: { value: 'river' } });
    expect(screen.getByTestId('required-equity').textContent).toBe('25.0%');
    expect(screen.queryByTestId('verdict')).toBeNull();
  });

  it('on the river the outs field is not required', () => {
    render(<PotOddsPanel />);
    fireEvent.change(screen.getByLabelText('Street'), { target: { value: 'river' } });
    type('Pot before the bet', '100');
    type('Bet', '50');
    expect(screen.getByTestId('required-equity').textContent).toBe('25.0%');
    expect(screen.queryByRole('alert')).toBeNull();
    type('Outs', '25');
    expect(screen.getByTestId('required-equity').textContent).toBe('25.0%');
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('a bet of 0 shows an alert and no result', () => {
    render(<PotOddsPanel />);
    type('Pot before the bet', '100');
    type('Bet', '0');
    type('Outs', '9');
    expect(screen.getByRole('alert').textContent).toMatch(/bet/i);
    expect(screen.queryByTestId('required-equity')).toBeNull();
  });

  it('shows a hint, not an alert, while the fields are still empty', () => {
    render(<PotOddsPanel />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText(/Enter the pot, the bet and your outs/i)).toBeTruthy();
  });
});

describe('IcmPanel', () => {
  it('shows a value for each of the 3 default players with the Model badge', () => {
    render(<IcmPanel />);
    const ref = icmEquities([5000, 3000, 2000], [50, 30, 20]);
    if (!ref.ok) throw new Error(ref.error);
    const rows = screen.getAllByTestId('icm-row');
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain(ref.values[0].toFixed(2));
    expect(screen.getByText('Model')).toBeTruthy();
    expect(screen.getByText(/ignores skill and blind pressure/i)).toBeTruthy();
  });

  it('editing a stack updates the values', () => {
    render(<IcmPanel />);
    type('Stack 1', '9000');
    const ref = icmEquities([9000, 3000, 2000], [50, 30, 20]);
    if (!ref.ok) throw new Error(ref.error);
    expect(screen.getAllByTestId('icm-row')[0].textContent).toContain(ref.values[0].toFixed(2));
  });

  it('removing a player is not possible at 2 players', () => {
    render(<IcmPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove player 3' }));
    expect(screen.queryByRole('button', { name: 'Remove player 3' })).toBeNull();
    for (const b of screen.getAllByRole('button', { name: /^Remove player/ })) expect((b as HTMLButtonElement).disabled).toBe(true);
  });

  it('adding a player stops at 10', () => {
    render(<IcmPanel />);
    for (let i = 0; i < 12; i++) {
      const add = screen.getByRole('button', { name: 'Add player' }) as HTMLButtonElement;
      if (!add.disabled) fireEvent.click(add);
    }
    expect(screen.getAllByLabelText(/^Stack \d+$/)).toHaveLength(10);
    expect((screen.getByRole('button', { name: 'Add player' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('a stack of 0 shows an alert and no values', () => {
    render(<IcmPanel />);
    type('Stack 2', '0');
    expect(screen.getByRole('alert').textContent).toMatch(/stack/i);
    expect(screen.queryAllByTestId('icm-row')).toHaveLength(0);
  });

  it('a cleared payout field is an error, not a silent zero', () => {
    render(<IcmPanel />);
    type('Payout 2', '');
    expect(screen.getByRole('alert').textContent).toMatch(/payouts/i);
    expect(screen.queryAllByTestId('icm-row')).toHaveLength(0);
    type('Payout 2', '   ');
    expect(screen.getByRole('alert')).toBeTruthy();
  });

  it('the chip column is labelled as a share, not a stack count', () => {
    render(<IcmPanel />);
    expect(screen.getByRole('columnheader', { name: 'Chip share' })).toBeTruthy();
    expect(screen.queryByRole('columnheader', { name: 'Chips' })).toBeNull();
  });

  it('more payouts than players shows an alert', () => {
    render(<IcmPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove player 3' }));
    expect(screen.getByRole('alert').textContent).toMatch(/payouts/i);
  });
});
