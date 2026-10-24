import { apply, createHand, finalStacks, playerView, type HandConfig, type HandState, type PlayerView } from '../engine/hand';
import { newCashGame, nextCashHand, rebuy, settleCash, CASH_BUY_IN, type CashGame } from '../engine/cashGame';
import {
  newTournament, nextTournamentHand, settleTournament, isOver as tournamentOver, standings, payouts,
  type Tournament,
} from '../engine/tournament';
import type { Action, LegalActions } from '../engine/types';
import type { HandLog } from '../engine/handLog';
import type { BotStyle } from '../bots/ranges';
import type { SessionRecord } from '../store/db';
import { RESUME_VERSION, type ResumeState } from '../store/resume';

export const HUMAN_ID = 0;
const STYLES: BotStyle[] = ['tight', 'loose', 'aggressive'];
const TOURNAMENT_BUY_IN = 100;
const TOURNAMENT_UNIT = 20; // starting big blind, used to express tournament profit in bb

export type SessionDeps = {
  saveHand: (h: HandLog) => Promise<void>;
  saveSession: (s: SessionRecord) => Promise<void>;
  saveResume: (r: ResumeState) => void;
  rng: () => number;
  now: () => number;
  decide: (view: PlayerView, style: BotStyle, rng: () => number) => Action;
  /** optional pacing hook awaited between bot actions (the UI uses it for animation) */
  pause?: () => Promise<void>;
};

export type Result = { ok: true } | { ok: false; error: string };

export type Session = {
  mode: 'cash' | 'tournament';
  state(): HandState;
  humanSeat(): number;
  view(): PlayerView | null;
  humanLegal(): LegalActions | null;
  submitHuman(a: Action): Result;
  stepBot(): boolean;
  runBotsUntilHuman(): Promise<void>;
  nextHand(): void;
  isOver(): boolean;
  /** cash only: ends the session and records it */
  leave(): Promise<void>;
  markHintUsed(): void;
  warning(): string | null;
  idle(): Promise<void>;
  onChange(cb: () => void): () => void;
  game(): CashGame | Tournament;
};

export function createSession(mode: 'cash' | 'tournament', deps: SessionDeps, resume?: ResumeState): Session {
  let game: CashGame | Tournament = resume?.game ?? (mode === 'cash' ? newCashGame([0, 1, 2, 3, 4, 5]) : newTournament());
  let pendingGame: CashGame | Tournament | null = null; // game after the finished hand is settled
  let cfg!: HandConfig;
  let state!: HandState;
  let usedHint = resume?.usedHint ?? false;
  let humanIdx = -1;
  let warn: string | null = null;
  let buyIns = resume?.buyIns ?? 1;
  let startedAt = resume?.startedAt ?? deps.now();
  // set when the user leaves: stops bots and all further saves so an abandoned game cannot reappear
  let disposed = false;
  const pending = new Set<Promise<void>>();
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((cb) => cb());
  const track = (p: Promise<void>) => {
    pending.add(p);
    void p.finally(() => pending.delete(p));
  };

  function startHand(config: HandConfig, actions: Action[]) {
    cfg = config;
    humanIdx = cfg.seats.findIndex((s) => s.id === HUMAN_ID);
    state = createHand(cfg);
    for (const a of actions) {
      const r = apply(state, a);
      if (!r.ok) throw new Error(`cannot restore saved hand: ${r.error}`);
      state = r.state;
    }
  }

  function nextConfig(): HandConfig {
    const seed = Math.floor(deps.rng() * 2 ** 31);
    return mode === 'cash' ? nextCashHand(game as CashGame, seed) : nextTournamentHand(game as Tournament, seed);
  }

  function persist() {
    if (disposed) return;
    deps.saveResume({
      version: RESUME_VERSION, mode, game, handConfig: cfg, actions: state.log.map((e) => e.action),
      humanSeat: humanIdx, usedHint, buyIns, startedAt,
    });
  }

  function finishHand() {
    const byId = new Map<number, number>();
    for (const [idx, stack] of finalStacks(state)) byId.set(cfg.seats[idx].id, stack);
    const handNumber = game.handNumber + 1;
    if (humanIdx >= 0) {
      const start = cfg.seats[humanIdx].stack;
      const log: HandLog = {
        id: `${mode}-${handNumber}-${cfg.seed}`, seed: cfg.seed, mode, seats: cfg.seats, button: cfg.buttonSeat,
        blinds: { sb: cfg.smallBlind, bb: cfg.bigBlind }, actions: state.log, humanSeat: humanIdx, usedHint,
        netBb: (byId.get(HUMAN_ID)! - start) / cfg.bigBlind, timestamp: deps.now(),
      };
      track(deps.saveHand(log).catch(() => { warn = 'This hand was not saved (storage write failed).'; notify(); }));
    }
    if (mode === 'cash') {
      pendingGame = settleCash(game as CashGame, byId);
    } else {
      const t = settleTournament(game as Tournament, byId);
      pendingGame = t;
      const human = t.players.find((p) => p.id === HUMAN_ID)!;
      if (human.stack === 0 || tournamentOver(t)) {
        const place = standings(t).indexOf(HUMAN_ID) + 1;
        const prize = payouts(t).get(HUMAN_ID) ?? 0;
        track(deps.saveSession({
          id: `tournament-${cfg.seed}`, mode, place, profitBb: (prize - TOURNAMENT_BUY_IN) / TOURNAMENT_UNIT,
          endedAt: deps.now(),
        }).catch(() => { warn = 'This result was not saved (storage write failed).'; notify(); }));
      }
    }
  }

  function afterAction() {
    if (state.street === 'done') finishHand();
    persist();
    notify();
  }

  startHand(resume?.handConfig ?? nextConfig(), resume?.actions ?? []);
  if (state.street === 'done') finishHand();
  persist();

  const session: Session = {
    mode,
    state: () => state,
    humanSeat: () => humanIdx,
    view: () => (humanIdx >= 0 ? playerView(state, humanIdx) : null),
    humanLegal() {
      if (humanIdx < 0 || state.street === 'done' || state.round.toAct !== humanIdx) return null;
      return playerView(state, humanIdx).legal;
    },
    submitHuman(a) {
      if (disposed || state.street === 'done' || state.round.toAct !== humanIdx) return { ok: false, error: 'not your turn' };
      const r = apply(state, a);
      if (!r.ok) return r;
      state = r.state;
      afterAction();
      return { ok: true };
    },
    stepBot() {
      if (disposed || state.street === 'done' || state.round.toAct === humanIdx || state.round.toAct < 0) return false;
      const seat = state.round.toAct;
      const style = STYLES[cfg.seats[seat].id % STYLES.length];
      const action = deps.decide(playerView(state, seat), style, deps.rng);
      const r = apply(state, action);
      if (!r.ok) throw new Error(`bot made an illegal action: ${r.error}`);
      state = r.state;
      afterAction();
      return true;
    },
    async runBotsUntilHuman() {
      while (state.street !== 'done' && state.round.toAct !== humanIdx) {
        if (!session.stepBot()) break;
        if (deps.pause) await deps.pause();
      }
    },
    nextHand() {
      if (state.street !== 'done') throw new Error('hand is still in progress');
      if (session.isOver()) throw new Error('session is over');
      game = pendingGame ?? game;
      pendingGame = null;
      if (mode === 'cash') {
        for (const p of (game as CashGame).players) {
          if (p.stack === 0) {
            game = rebuy(game as CashGame, p.id);
            if (p.id === HUMAN_ID) buyIns++;
          }
        }
      }
      usedHint = false;
      startHand(nextConfig(), []);
      persist();
      notify();
    },
    isOver() {
      if (mode === 'cash') return false;
      const t = (state.street === 'done' ? pendingGame ?? game : game) as Tournament;
      return t.players.find((p) => p.id === HUMAN_ID)!.stack === 0 || tournamentOver(t);
    },
    async leave() {
      disposed = true;
      if (mode !== 'cash') return;
      const g = (pendingGame ?? game) as CashGame;
      const human = g.players.find((p) => p.id === HUMAN_ID)!;
      const bb = cfg.bigBlind;
      track(deps.saveSession({
        id: `cash-${startedAt}`, mode, profitBb: (human.stack - buyIns * CASH_BUY_IN) / bb, endedAt: deps.now(),
      }).catch(() => { warn = 'This session was not saved (storage write failed).'; notify(); }));
      startedAt = deps.now();
      await session.idle();
    },
    markHintUsed() {
      usedHint = true;
      persist();
    },
    warning: () => warn,
    async idle() {
      await Promise.all([...pending]);
    },
    onChange(cb) {
      listeners.add(cb);
      return () => void listeners.delete(cb);
    },
    game: () => (state.street === 'done' ? pendingGame ?? game : game),
  };
  return session;
}
