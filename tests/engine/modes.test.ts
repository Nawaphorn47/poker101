import { levelForHand, nextButton, TOURNAMENT_LEVELS } from '../../src/engine/blinds';
import { newCashGame, rebuy, settleCash, nextCashHand } from '../../src/engine/cashGame';
import { newTournament, nextTournamentHand, settleTournament, isOver, payouts } from '../../src/engine/tournament';

describe('blinds', () => {
  it('hands 1..10 are 10/20 and hand 11 is 15/30', () => {
    expect(levelForHand(1)).toEqual({ sb: 10, bb: 20 });
    expect(levelForHand(10)).toEqual({ sb: 10, bb: 20 });
    expect(levelForHand(11)).toEqual({ sb: 15, bb: 30 });
  });
  it('last level repeats past hand 100', () => {
    const last = TOURNAMENT_LEVELS[TOURNAMENT_LEVELS.length - 1];
    expect(levelForHand(101)).toEqual(last);
    expect(levelForHand(500)).toEqual(last);
  });
  it('button skips missing seats and wraps', () => {
    expect(nextButton([0, 2, 5], 0)).toBe(2);
    expect(nextButton([0, 2, 5], 5)).toBe(0);
    expect(nextButton([0, 2, 5], 1)).toBe(2);
  });
});

describe('cash game', () => {
  it('starts 6 players at 200 with 1/2 blinds', () => {
    const g = newCashGame([0, 1, 2, 3, 4, 5]);
    const cfg = nextCashHand(g, 1);
    expect(cfg.seats).toHaveLength(6);
    expect(cfg.seats[0].stack).toBe(200);
    expect([cfg.smallBlind, cfg.bigBlind]).toEqual([1, 2]);
  });
  it('rebuy restores 200 stack for a busted player', () => {
    let g = newCashGame([0, 1, 2]);
    g = settleCash(g, new Map([[0, 0], [1, 400], [2, 200]]));
    expect(rebuy(g, 0).players.find((p) => p.id === 0)!.stack).toBe(200);
  });
  it('moves the button each hand', () => {
    let g = newCashGame([0, 1, 2]);
    g = settleCash(g, new Map([[0, 200], [1, 200], [2, 200]]));
    expect(g.buttonId).toBe(1);
  });
});

describe('tournament', () => {
  it('starts 9 players at 1500', () => {
    const t = newTournament();
    expect(t.players).toHaveLength(9);
    expect(nextTournamentHand(t, 1).seats.every((s) => s.stack === 1500)).toBe(true);
  });
  it('busted player is removed and ordered in eliminated', () => {
    let t = newTournament();
    const stacks = new Map(t.players.map((p) => [p.id, 1500]));
    stacks.set(3, 0).set(0, 3000);
    t = settleTournament(t, stacks);
    expect(t.eliminated).toEqual([3]);
    expect(nextTournamentHand(t, 2).seats.map((s) => s.id)).not.toContain(3);
  });
  it('button skips eliminated seats', () => {
    let t = newTournament();
    const stacks = new Map(t.players.map((p) => [p.id, 1500]));
    stacks.set(1, 0).set(0, 3000);
    t = settleTournament(t, stacks);
    expect(t.buttonId).toBe(2);
  });
  it('level rises after 10 hands', () => {
    let t = newTournament();
    const same = new Map(t.players.map((p) => [p.id, 1500]));
    for (let i = 0; i < 10; i++) t = settleTournament(t, same);
    expect(nextTournamentHand(t, 1).bigBlind).toBe(30);
  });
  it('ends with one player and pays 450/270/180', () => {
    let t = newTournament();
    const total = 9 * 1500;
    // players bust in order 8,7,...,1; player 0 wins
    for (let bust = 8; bust >= 1; bust--) {
      const stacks = new Map<number, number>([[bust, 0], [0, total - (bust - 1)]]);
      for (let id = 1; id < bust; id++) stacks.set(id, 1);
      t = settleTournament(t, stacks);
    }
    expect(isOver(t)).toBe(true);
    const p = payouts(t);
    expect(p.get(0)).toBe(450);
    expect(p.get(1)).toBe(270);
    expect(p.get(2)).toBe(180);
  });
  it('heads-up button alternates between the two remaining players', () => {
    let t = newTournament();
    const s = new Map(t.players.map((p) => [p.id, 0]));
    s.set(4, 7000).set(6, 6500);
    t = settleTournament(t, s);
    const b1 = t.buttonId;
    t = settleTournament(t, new Map([[4, 7000], [6, 6500]]));
    expect(t.buttonId).not.toBe(b1);
  });
});
