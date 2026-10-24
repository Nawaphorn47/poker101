import type { HandConfig } from './hand';
import { applyStacks, makeHandConfig, nextButton, type Player } from './blinds';

export const CASH_BUY_IN = 200;
export const CASH_BLINDS = { sb: 1, bb: 2 };

export type CashGame = { players: Player[]; buttonId: number; handNumber: number };

export function newCashGame(playerIds: number[]): CashGame {
  return {
    players: playerIds.map((id) => ({ id, stack: CASH_BUY_IN })),
    buttonId: playerIds[0],
    handNumber: 0,
  };
}

export function nextCashHand(g: CashGame, seed: number): HandConfig {
  return makeHandConfig(g.players, g.buttonId, seed, CASH_BLINDS);
}

/** stacks are keyed by player id. */
export function settleCash(g: CashGame, stacks: Map<number, number>): CashGame {
  const players = applyStacks(g.players, stacks);
  return {
    players,
    handNumber: g.handNumber + 1,
    buttonId: nextButton(players.map((p) => p.id), g.buttonId),
  };
}

export function rebuy(g: CashGame, id: number): CashGame {
  return { ...g, players: g.players.map((p) => (p.id === id ? { ...p, stack: CASH_BUY_IN } : p)) };
}
