import { startEquity } from '../../src/tools/equityRunner';
import { parseCard } from '../../src/engine/cards';
import type { EquityResult } from '../../src/tools/equity';

// every calculation entry point throws, to prove the runner reports a plain message instead of hanging
vi.mock('../../src/tools/equity', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/tools/equity')>();
  return {
    ...actual,
    enumerateEquity: () => {
      throw new Error('boom');
    },
    createSimulation: () => {
      throw new Error('boom');
    },
  };
});

const hands = ['As Ah', 'Ks Kh'].map((h) => h.split(' ').map(parseCard));

function firstUpdate(board: string): Promise<{ r: EquityResult; done: boolean }> {
  return new Promise((resolve) => {
    startEquity({ hands, board: board ? board.split(' ').map(parseCard) : [] }, (r, done) => resolve({ r, done }), {
      useWorker: false,
    });
  });
}

describe('startEquity when the calculation throws', () => {
  it('an exact run reports could-not-calculate and is done', async () => {
    const { r, done } = await firstUpdate('2c 7d 9h');
    expect(done).toBe(true);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.error).toMatch(/could not calculate/i);
  });
  it('a simulated run reports could-not-calculate and is done', async () => {
    const { r, done } = await firstUpdate('');
    expect(done).toBe(true);
    expect(r.ok === false && r.error).toMatch(/could not calculate/i);
  });
});
