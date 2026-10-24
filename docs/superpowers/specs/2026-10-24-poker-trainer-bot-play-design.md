# Poker Trainer — Phase 1: Play vs Bots (Design)

Date: 2026-10-24

## Purpose and scope

A browser-only website for practicing Texas Hold'em No-Limit decision making, with play-money tables against bots in both **cash game** and **tournament** formats. The goal is that the player can practice real decisions, not that the bots are solver-grade.

This is phase 1 of 3. Later phases (separate specs): (2) quiz/drill of situations, (3) calculator tools (equity, pot odds, ICM, push/fold). They reuse `engine/` and `coach/` from this phase.

### Assumptions (confirm or correct)
- Texas Hold'em No-Limit only. Play money only.
- One human vs bots. Cash: 6-max. Tournament: 9-handed, single table (sit-and-go) with rising blinds, bubble, final table, simulated payouts.
- Bots play "reasonably" (position-based ranges, equity, pot odds), not GTO.
- No backend, no accounts. Data stays in the browser.

### Success criteria
- A full cash session and a full tournament can be played to completion with correct rules (pots, side pots, split pots, showdown).
- Bots never submit illegal actions and play plausibly.
- Hints are usable during play; hands can be reviewed afterward.
- Stats and hand history persist across reloads.

### Out of scope (phase 1)
Multi-table tournaments, multiplayer, real money, PLO/other variants, solver/GTO, user accounts.

## Stack
TypeScript, React, Vite, Vitest. Equity simulation runs in a Web Worker.

## Architecture

Three layers; lower layers never depend on higher ones.

```
src/
  engine/   rules of poker, no React/browser dependency
  bots/     bot decision logic
  coach/    hints, equity, hand review
  store/    stats + hand history persistence
  ui/       React: table, action buttons, stats page, review page
```

### engine/ (pure functions)
- `cards`, `deck` — seeded shuffle so a hand can be replayed exactly.
- `handEvaluator` — rank best 5 of 7 cards.
- `hand` — state machine of one hand (preflop, flop, turn, river, showdown); `apply(state, action)` returns new state plus events.
- `pots` — main pot, side pots, split pots including odd-chip handling.
- `betting` — legal actions (min-raise, all-in, short all-in); `legalActions(state)`.
- `blinds` — blind/ante schedule, dealer button movement.

Cash and tournament share the engine; a thin game controller differs:
- Cash: rebuy allowed, fixed blinds, can leave any time.
- Tournament: equal starting stacks, blinds rise by time or hand count, busted players eliminated, ends with one player, simulated payouts by rank.

### bots/
`decide(view, seat) -> action`. Several styles (tight, loose, aggressive). Uses position-based preflop ranges, then equity and pot odds postflop. A bot only receives a `view`: its own hole cards plus public information.

### coach/ and store/
Observers only. They read hand logs; nothing in `engine/` calls back into them.

## Data flow
1. UI calls `session.start(mode, config)`.
2. Bot turn: session calls `bot.decide(view, seat)` and passes the action to `engine.apply`.
3. Human turn: UI shows only `legalActions`; the chosen action goes to `engine.apply`.
4. `apply` returns new state plus events; UI renders from state. No game rules live in UI.
5. End of hand: session writes a hand log (seed, seats, starting stacks, every action) to the store.

## Coach
- **Hint (during play, toggleable):** pot odds, approximate equity (Monte Carlo, limited samples, Web Worker), preflop suggestion by position. Hands where hints were used are tagged in history.
- **Post-hand review:** replay the hand log action by action; flag decisions that differ from the suggestion (e.g. call with insufficient pot odds, fold with high equity), with a short explanation and all-in equity.
- Reviews are rule/equity based, not GTO; the UI says so.

## Data
Stored in IndexedDB, never sent anywhere.
- `hands`: hand logs.
- `sessions`: cash sessions / tournaments with result (finish place, profit in bb).
- Stats (VPIP, PFR, bb/100, showdown win rate) are computed from hand logs, not stored separately, so formulas can change without data loss.
- JSON export/import for backup, since clearing browser data erases history.

## Error handling
- Illegal action: `apply` returns an error and leaves state unchanged (defensive; UI should not offer them).
- Engine invariants (total chips constant, pot equals sum of contributions) are checked every hand; on violation the hand stops and a debug log is saved.
- Tab closed mid-hand: latest state is saved and play resumes on reopen.
- IndexedDB write failure: play continues with a warning that the hand was not saved.

## Testing
- Engine (heaviest): hand evaluator tables and kicker comparisons, multi-level side pots, split pots with odd chips, min-raise and short all-in, blind schedule.
- Property tests: thousands of random-bot hands verify chips are conserved and games terminate.
- Bots: never produce illegal actions; style differences show in stats (tight VPIP below loose).
- UI: a few main flows only (start game, play a hand to completion, open review). No pixel tests.
