import { createHand, apply, checkInvariants, finalStacks, type HandState } from '../../src/engine/hand';
import { randomLegalAction } from '../../src/engine/randomPlayer';
import { mulberry32 } from '../../src/engine/deck';
import { newTournament, nextTournamentHand, settleTournament, isOver } from '../../src/engine/tournament';

function playRandomHand(state: HandState, rng: () => number): { state: HandState; actions: number } {
  let actions = 0;
  while (state.street !== 'done') {
    const r = apply(state, randomLegalAction(state, rng));
    if (!r.ok) throw new Error(`random legal action rejected: ${r.error}`);
    state = r.state;
    const bad = checkInvariants(state);
    if (bad) throw new Error(bad);
    if (++actions > 200) throw new Error('hand did not terminate');
  }
  return { state, actions };
}

describe('engine property tests', () => {
  it('5000 random hands at 2-9 players conserve chips, never throw, and terminate', () => {
    const rng = mulberry32(12345);
    for (let i = 0; i < 5000; i++) {
      const n = 2 + Math.floor(rng() * 8);
      const seats = Array.from({ length: n }, (_, id) => ({ id, stack: 5 + Math.floor(rng() * 300) }));
      const total = seats.reduce((a, s) => a + s.stack, 0);
      const s0 = createHand({ seed: i, seats, buttonSeat: Math.floor(rng() * n), smallBlind: 1, bigBlind: 2 });
      const { state } = playRandomHand(s0, rng);
      const after = [...finalStacks(state).values()].reduce((a, b) => a + b, 0);
      expect(after).toBe(total);
    }
  });

  it('a full random tournament ends with exactly one player holding 13500 chips', () => {
    const rng = mulberry32(999);
    let t = newTournament();
    let hands = 0;
    while (!isOver(t)) {
      if (++hands > 5000) throw new Error('tournament did not end');
      const cfg = nextTournamentHand(t, hands);
      const { state } = playRandomHand(createHand(cfg), rng);
      const byId = new Map<number, number>();
      for (const [idx, stack] of finalStacks(state)) byId.set(cfg.seats[idx].id, stack);
      t = settleTournament(t, byId);
    }
    const alive = t.players.filter((p) => p.stack > 0);
    expect(alive).toHaveLength(1);
    expect(alive[0].stack).toBe(13500);
    expect(t.eliminated).toHaveLength(8);
  });

  it('invariant check rejects a state whose chips do not add up', () => {
    const s = createHand({ seed: 1, seats: [{ id: 0, stack: 100 }, { id: 1, stack: 100 }], buttonSeat: 0, smallBlind: 1, bigBlind: 2 });
    expect(checkInvariants(s)).toBeNull();
    const tampered = { ...s, seats: s.seats.map((x, i) => (i === 0 ? { ...x, stack: x.stack + 1 } : x)) };
    expect(checkInvariants(tampered)).not.toBeNull();
  });
});
