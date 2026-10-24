import 'fake-indexeddb/auto';
import { render, screen, fireEvent } from '@testing-library/react';
import { App } from '../../src/ui/App';
import { CardPicker } from '../../src/ui/CardPicker';
import { parseCard } from '../../src/engine/cards';

describe('CardPicker', () => {
  const open = (label: string) => fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}:`) }));

  it('disables cards used elsewhere but not its own current card', () => {
    render(<CardPicker label="Seat 1 card 1" value={parseCard('As')} used={[parseCard('As'), parseCard('Kd')]} onChange={() => {}} />);
    open('Seat 1 card 1');
    expect((screen.getByRole('button', { name: 'Kd' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'As' }) as HTMLButtonElement).disabled).toBe(false);
    expect((screen.getByRole('button', { name: 'Qh' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows all 52 cards in the grid', () => {
    render(<CardPicker label="Board 1" value={null} used={[]} onChange={() => {}} />);
    open('Board 1');
    const grid = screen.getByRole('dialog');
    expect(grid.querySelectorAll('button[data-card]')).toHaveLength(52);
  });

  it('onChange receives the chosen card and closes the grid', () => {
    const calls: unknown[] = [];
    render(<CardPicker label="Board 1" value={null} used={[]} onChange={(c) => calls.push(c)} />);
    open('Board 1');
    fireEvent.click(screen.getByRole('button', { name: 'Qh' }));
    expect(calls).toEqual([{ rank: 12, suit: 'h' }]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Clear sends null', () => {
    const calls: unknown[] = [];
    render(<CardPicker label="Board 1" value={parseCard('9c')} used={[parseCard('9c')]} onChange={(c) => calls.push(c)} />);
    open('Board 1');
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(calls).toEqual([null]);
  });

  it('the slot says which card it holds', () => {
    render(<CardPicker label="Board 1" value={parseCard('9c')} used={[]} onChange={() => {}} />);
    expect(screen.getByRole('button', { name: 'Board 1: 9c' })).toBeTruthy();
  });
});

describe('tools page', () => {
  const openTools = () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Tools' }));
  };

  it('the lobby has a Tools button that opens the tools page', () => {
    openTools();
    expect(screen.getByRole('tablist')).toBeTruthy();
  });

  it('has the four tabs and the first is selected', () => {
    openTools();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Pot odds', 'ICM', 'Equity', 'Push/fold chart']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
    expect(tabs[1].getAttribute('aria-selected')).toBe('false');
  });

  it('switching tabs shows the chosen panel and hides the others', () => {
    openTools();
    expect(screen.getByRole('tabpanel', { name: 'Pot odds' })).toBeTruthy();
    fireEvent.click(screen.getByRole('tab', { name: 'ICM' }));
    expect(screen.getByRole('tabpanel', { name: 'ICM' })).toBeTruthy();
    expect(screen.queryByRole('tabpanel', { name: 'Pot odds' })).toBeNull();
  });

  it('a value typed into a panel survives switching away and back', () => {
    openTools();
    const input = screen.getByLabelText('Pot before the bet') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '123' } });
    fireEvent.click(screen.getByRole('tab', { name: 'ICM' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Pot odds' }));
    expect((screen.getByLabelText('Pot before the bet') as HTMLInputElement).value).toBe('123');
  });

  it('Back returns to the lobby', () => {
    openTools();
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: 'Tools' })).toBeTruthy();
  });
});
