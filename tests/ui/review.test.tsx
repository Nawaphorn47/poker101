import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { StatsPage } from '../../src/ui/StatsPage';
import { ReviewPage } from '../../src/ui/ReviewPage';
import { saveHand, clearAll } from '../../src/store/db';
import { createHand } from '../../src/engine/hand';
import { chenScore } from '../../src/engine/handClass';
import type { HandLog } from '../../src/engine/handLog';

const log = (id: string, humanSeat: number, actions: HandLog['actions'], netBb = 0, extra: Partial<HandLog> = {}): HandLog => ({
  id, seed: 1, mode: 'cash', seats: [{ id: 0, stack: 1000 }, { id: 1, stack: 1000 }], button: 0,
  blinds: { sb: 10, bb: 20 }, actions, humanSeat, usedHint: false, netBb, timestamp: Number(id) || 1, ...extra,
});

const fourHands = (): HandLog[] => [
  log('1', 1, [{ seat: 0, action: { type: 'raise', amount: 40 } }, { seat: 1, action: { type: 'fold' } }], -1),
  log('2', 0, [{ seat: 0, action: { type: 'call' } }, { seat: 1, action: { type: 'fold' } }], 1, { usedHint: true }),
  log('3', 0, [{ seat: 0, action: { type: 'raise', amount: 60 } }, { seat: 1, action: { type: 'fold' } }], 1),
  log('4', 1, [
    { seat: 0, action: { type: 'call' } }, { seat: 1, action: { type: 'check' } },
    { seat: 1, action: { type: 'check' } }, { seat: 0, action: { type: 'fold' } },
  ], 1),
];

beforeEach(async () => {
  await clearAll();
});

describe('stats page', () => {
  it('shows VPIP, PFR and bb/100 for saved hands', async () => {
    for (const h of fourHands()) await saveHand(h);
    render(<StatsPage onBack={() => {}} onReview={() => {}} />);
    await waitFor(() => expect(screen.getByTestId('stat-vpip').textContent).toBe('50%'));
    expect(screen.getByTestId('stat-pfr').textContent).toBe('25%');
    expect(screen.getByTestId('stat-bb100').textContent).toBe('50.0');
  });

  it('hand list tags hint-used hands', async () => {
    for (const h of fourHands()) await saveHand(h);
    render(<StatsPage onBack={() => {}} onReview={() => {}} />);
    await screen.findAllByText(/^Hand \d/);
    expect(screen.getAllByText('Hint used')).toHaveLength(1);
  });

  it('import of a bad file shows an error and keeps existing history', async () => {
    for (const h of fourHands()) await saveHand(h);
    render(<StatsPage onBack={() => {}} onReview={() => {}} />);
    await screen.findAllByText(/^Hand \d/);
    const input = screen.getByLabelText('Import backup') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['{bad'], 'bad.json', { type: 'application/json' })] } });
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/not valid json|unrecognised/i);
    expect(screen.getAllByText(/^Hand \d/)).toHaveLength(4);
  });
});

describe('review page', () => {
  async function seedQuestionableCall(): Promise<string> {
    let seed = 1;
    for (; seed < 100000; seed++) {
      const s = createHand({ seed, seats: [{ id: 0, stack: 1000 }, { id: 1, stack: 1000 }], buttonSeat: 0, smallBlind: 10, bigBlind: 20 });
      const h = s.seats[1].hole;
      if (chenScore(h) <= 0 && h[0].rank !== h[1].rank) break;
    }
    await saveHand(log('9', 1, [{ seat: 0, action: { type: 'raise', amount: 200 } }, { seat: 1, action: { type: 'call' } }], 0, { seed }));
    return '9';
  }

  it('steps through actions and highlights questionable decisions', async () => {
    const id = await seedQuestionableCall();
    const { container } = render(<ReviewPage handId={id} onBack={() => {}} />);
    await screen.findByText(/Called with/);
    expect(container.querySelector('[data-flag="questionable"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-testid="review-step"]')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(container.querySelectorAll('[data-testid="review-step"]')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(container.querySelectorAll('[data-testid="review-step"]')).toHaveLength(2);
  });

  it('shows the not-GTO disclaimer', async () => {
    const id = await seedQuestionableCall();
    render(<ReviewPage handId={id} onBack={() => {}} />);
    expect(await screen.findByText(/not a GTO solver/i)).toBeTruthy();
  });

  it('shows a message when the hand does not exist', async () => {
    render(<ReviewPage handId="missing" onBack={() => {}} />);
    expect(await screen.findByText(/not found/i)).toBeTruthy();
  });
});
