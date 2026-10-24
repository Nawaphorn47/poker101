import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../../src/ui/App';
import { decide } from '../../src/bots/decide';
import { mulberry32 } from '../../src/engine/deck';
import type { SessionDeps } from '../../src/session/session';
import type { HandLog } from '../../src/engine/handLog';

function fakeDeps(over: Partial<SessionDeps> = {}) {
  const hands: HandLog[] = [];
  const deps: Partial<SessionDeps> = {
    saveHand: async (h) => void hands.push(h),
    saveSession: async () => {},
    saveResume: () => {},
    rng: mulberry32(77),
    now: () => 5,
    decide,
    pause: undefined,
    ...over,
  };
  return { deps, hands };
}

async function playOut() {
  for (let i = 0; i < 80; i++) {
    const btn = await screen.findByRole('button', { name: /^(Check|Call|Next hand|Finish)/ });
    if (/^(Next hand|Finish)/.test(btn.textContent ?? '')) return;
    fireEvent.click(btn);
  }
  throw new Error('hand did not finish');
}

beforeEach(() => {
  localStorage.clear();
});

describe('play flow', () => {
  it('lobby starts a cash game and shows 6 seats', async () => {
    render(<App deps={fakeDeps().deps} />);
    fireEvent.click(screen.getByText(/Cash game/));
    await waitFor(() => expect(screen.getAllByTestId('seat')).toHaveLength(6));
  });

  it('lobby starts a tournament and shows 9 seats', async () => {
    render(<App deps={fakeDeps().deps} />);
    fireEvent.click(screen.getByText(/Tournament/));
    await waitFor(() => expect(screen.getAllByTestId('seat')).toHaveLength(9));
  });

  it('action bar shows no Check when facing a bet', async () => {
    render(<App deps={fakeDeps().deps} />);
    fireEvent.click(screen.getByText(/Cash game/));
    await screen.findByRole('button', { name: /^Call/ });
    expect(screen.queryByRole('button', { name: /^Check/ })).toBeNull();
  });

  it('playing check/call to the end of a hand shows the result', async () => {
    render(<App deps={fakeDeps().deps} />);
    fireEvent.click(screen.getByText(/Cash game/));
    await playOut();
    expect(screen.getAllByText(/won \d+/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Next hand' })).toBeTruthy();
  });

  it('hint panel is hidden until toggled and toggling marks the hand as hint-used', async () => {
    const { deps, hands } = fakeDeps();
    render(<App deps={deps} />);
    fireEvent.click(screen.getByText(/Cash game/));
    const hintBtn = await screen.findByRole('button', { name: 'Hint' });
    expect(screen.queryByText(/Equity about/)).toBeNull();
    fireEvent.click(hintBtn);
    await screen.findByText(/Equity about/);
    await playOut();
    await waitFor(() => expect(hands).toHaveLength(1));
    expect(hands[0].usedHint).toBe(true);
  });

  it('save warning banner appears when saving fails', async () => {
    const { deps } = fakeDeps({ saveHand: async () => { throw new Error('quota'); } });
    render(<App deps={deps} />);
    fireEvent.click(screen.getByText(/Cash game/));
    await playOut();
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/not saved/i);
  });
});
