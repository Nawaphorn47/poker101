import { render, screen, fireEvent } from '@testing-library/react';
import { ChartPanel } from '../../src/ui/tools/ChartPanel';
import { chartFor } from '../../src/tools/chart';

const grid = (container: HTMLElement) => container.querySelector('.chart-grid') as HTMLElement;

describe('ChartPanel', () => {
  it('renders 169 hand cells', () => {
    const { container } = render(<ChartPanel />);
    expect(grid(container).querySelectorAll('button')).toHaveLength(169);
  });

  it('lays the grid out with AA first, AKs to its right and AKo below it', () => {
    const { container } = render(<ChartPanel />);
    const cells = [...grid(container).children] as HTMLElement[];
    expect(cells[0].dataset.name).toBe('AA');
    expect(cells[1].dataset.name).toBe('AKs');
    expect(cells[13].dataset.name).toBe('AKo');
    expect(cells[168].dataset.name).toBe('22');
  });

  it('starts at 10bb as the small blind and shows the share of combinations', () => {
    render(<ChartPanel />);
    expect(screen.getByTestId('chart-pct').textContent).toBe(`${chartFor(10, 'sb').pct.toFixed(1)}% of combinations`);
    expect(screen.getByRole('button', { name: 'AA push' })).toBeTruthy();
  });

  it('moving the slider changes the summary', () => {
    render(<ChartPanel />);
    fireEvent.change(screen.getByLabelText('Stack (bb)'), { target: { value: '2' } });
    expect(screen.getByTestId('chart-pct').textContent).toBe(`${chartFor(2, 'sb').pct.toFixed(1)}% of combinations`);
    fireEvent.change(screen.getByLabelText('Stack (bb)'), { target: { value: '15' } });
    expect(screen.getByTestId('chart-pct').textContent).toBe(`${chartFor(15, 'sb').pct.toFixed(1)}% of combinations`);
  });

  it('toggling to the big blind changes the summary and the cell actions', () => {
    render(<ChartPanel />);
    fireEvent.click(screen.getByRole('button', { name: 'BB calls' }));
    expect(screen.getByTestId('chart-pct').textContent).toBe(`${chartFor(10, 'bb').pct.toFixed(1)}% of combinations`);
    expect(screen.getByRole('button', { name: 'AA call' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'AA push' })).toBeNull();
  });

  it('selecting a cell shows its EVs and best action', () => {
    render(<ChartPanel />);
    expect(screen.getByText(/Select a hand/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /^AKo / }));
    const detail = screen.getByTestId('cell-detail').textContent!;
    const cell = chartFor(10, 'sb').cells.find((c) => c.name === 'AKo')!;
    expect(detail).toContain('AKo');
    expect(detail).toContain(cell.ev.toFixed(2));
    expect(detail).toContain('-0.50');
    expect(detail).toContain(cell.action);
  });

  it('shows the heads-up caveat', () => {
    render(<ChartPanel />);
    expect(screen.getByText(/Heads-up only/i).textContent).toMatch(/card removal/i);
  });

  it('marks borderline cells', () => {
    const { container } = render(<ChartPanel />);
    const expected = chartFor(10, 'sb').cells.filter((c) => c.borderline).length;
    expect(grid(container).querySelectorAll('button.borderline')).toHaveLength(expected);
    expect(expected).toBeGreaterThan(0);
  });
});
