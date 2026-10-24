# Poker Trainer Phase 1 (Play vs Bots) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser-only Texas Hold'em No-Limit trainer where one human plays play-money cash games and single-table tournaments against bots, with hints, post-hand review, and persistent stats.

**Architecture:** A pure `engine/` (rules, no React) is driven by a `session` orchestrator. `bots/` decide from a per-seat view. `coach/` and `store/` only observe hand logs. `ui/` renders state and never contains rules.

**Tech Stack:** TypeScript, React, Vite, Vitest, IndexedDB (via `idb`), Web Worker for equity.

**Spec:** `docs/superpowers/specs/2026-10-24-poker-trainer-bot-play-design.md`

## Global Constraints

- Texas Hold'em No-Limit only; play money only; no backend, no accounts; data never leaves the browser.
- Cash: 6-max. Tournament: 9-handed, single table, blinds rise by hand count, busted players eliminated, simulated payouts by rank.
- `engine/` has no dependency on React, DOM, or browser APIs; all functions pure; shuffle is seeded.
- Layer rule: `engine` <- `bots`, `coach` <- `store`, `ui`. Nothing in `engine` imports from another layer.
- Bots only receive a `PlayerView` (own hole cards + public info).
- Stats are computed from hand logs, never stored separately.
- Equity simulation runs in a Web Worker with a limited sample count.
- Illegal action: `apply` returns an error and leaves state unchanged.
- Out of scope: multi-table, multiplayer, real money, PLO/other variants, solver/GTO, accounts.

### Values the spec leaves open (decided here)
- Cash: blinds 1/2, buy-in 200 (100bb), rebuy allowed between hands.
- Tournament: 9 players, 1500 starting chips, blinds start 10/20, level up every 10 hands (ladder: 10/20, 15/30, 25/50, 50/100, 75/150, 100/200, 150/300, 200/400, 300/600, 500/1000), no ante, payouts 50% / 30% / 20% of a 900-unit prize pool to places 1-3.
- Odd chip in a split pot goes to the first winner clockwise from the button.
- Short all-in (less than a full raise) does not reopen betting for players who already acted.

## Review Focus

- Heads-up (2 players left): button posts small blind and acts first preflop; the other player posts big blind.
- Player cannot cover the blind: posts what they have and is all-in; hand still resolves.
- Everyone all-in before the river: remaining board is dealt with no further betting.
- Everyone folds to one player preflop: that player wins uncontested without showdown.
- Saved state is corrupt or from an older shape on reload: app starts a fresh session instead of crashing.

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/ui/App.tsx`, `src/engine/index.ts`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: `npm run dev`, `npm test` (Vitest, `tests/**/*.test.ts`), directories `src/{engine,bots,coach,store,ui}`.

- [ ] **Step 1:** Run `git init` in `D:\poker101` (D: is already one repo containing other projects; confirm with the user before this step, else commit into the D: repo).
- [ ] **Step 2:** Scaffold Vite React-TS in `D:\poker101`; add `vitest`, `idb`, `fake-indexeddb` (dev). Strict TS on.
- [ ] **Step 3:** Write `tests/smoke.test.ts` asserting `1 + 1 === 2`; run `npm test`. Expected: PASS.
- [ ] **Step 4:** Run `npm run build`. Expected: succeeds.
- [ ] **Step 5:** Commit `chore: scaffold project`.

### Task 2: Cards and seeded deck

**Files:**
- Create: `src/engine/cards.ts`, `src/engine/deck.ts`; Test: `tests/engine/deck.test.ts`

**Interfaces:**
- Produces: `type Suit = 'c'|'d'|'h'|'s'`; `type Card = { rank: number /*2..14*/; suit: Suit }`; `cardToString(c: Card): string` (e.g. `"As"`); `parseCard(s: string): Card`; `shuffledDeck(seed: number): Card[]` (52 unique cards, deterministic).

- [ ] **Step 1:** Tests: `deck has 52 unique cards`; `same seed gives identical order`; `different seeds differ`; `parseCard(cardToString(c)) equals c for all 52`.
- [ ] **Step 2:** Run, expect FAIL. Implement with a mulberry32 PRNG and Fisher-Yates. Run, expect PASS.
- [ ] **Step 3:** Commit `feat(engine): cards and seeded deck`.

### Task 3: Hand evaluator

**Files:**
- Create: `src/engine/handEvaluator.ts`; Test: `tests/engine/handEvaluator.test.ts`

**Interfaces:**
- Consumes: `Card`, `parseCard`.
- Produces: `evaluate(cards: Card[] /*5-7*/): HandScore` where `HandScore = { category: 0..8; tiebreak: number[] }` (0 high card ... 8 straight flush); `compareScores(a: HandScore, b: HandScore): number`.

- [ ] **Step 1:** Tests (use `parseCard`): each of the 9 categories is detected from 7-card inputs; `wheel straight A-2-3-4-5 loses to 6-high straight`; `flush beats straight`; `full house compares trips before pair`; `same pair, higher kicker wins`; `board plays gives equal scores`; `royal flush > straight flush`.
- [ ] **Step 2:** Run, expect FAIL. Implement best-5-of-7 evaluation (enumerate the 21 combos or rank-count method). Run, expect PASS.
- [ ] **Step 3:** Commit `feat(engine): hand evaluator`.

### Task 4: Pots and showdown payouts

**Files:**
- Create: `src/engine/pots.ts`; Test: `tests/engine/pots.test.ts`

**Interfaces:**
- Consumes: `HandScore`, `compareScores`.
- Produces: `type Contribution = { seat: number; amount: number; folded: boolean }`; `type Pot = { amount: number; eligible: number[] }`; `buildPots(c: Contribution[]): Pot[]` (main + side pots, folded players' chips stay in pots but they are not eligible); `distribute(pots: Pot[], scores: Map<number, HandScore>, buttonSeat: number, seatCount: number): Map<number, number>` (seat -> winnings).

- [ ] **Step 1:** Tests: `three all-ins of 50/100/200 give 150, 100, 100 pots with eligibility [0,1,2],[1,2],[2]`; `folded contributor is not eligible but chips remain`; `two-way tie splits evenly`; `odd chip goes to first winner clockwise from button` (pot 101, two winners); `side pot goes to best eligible hand, not best overall`; `sum of payouts equals sum of contributions`.
- [ ] **Step 2:** Run, expect FAIL. Implement. Run, expect PASS.
- [ ] **Step 3:** Commit `feat(engine): pots and payouts`.

### Task 5: Betting rules and legal actions

**Files:**
- Create: `src/engine/types.ts`, `src/engine/betting.ts`; Test: `tests/engine/betting.test.ts`

**Interfaces:**
- Produces (types.ts): `type Action = { type: 'fold'|'check'|'call'|'bet'|'raise'; amount?: number /*total bet-to for this street, all-in when equals stack+committed*/ }`; `type Street = 'preflop'|'flop'|'turn'|'river'|'showdown'|'done'`; `type SeatState = { id: number; stack: number; committed: number /*this street*/; totalCommitted: number; hole: Card[]; folded: boolean; allIn: boolean; acted: boolean }`; `type BettingRound = { currentBet: number; lastRaiseSize: number; toAct: number; seats: SeatState[]; bigBlind: number }`; `type LegalActions = { canCheck: boolean; callAmount: number; minRaiseTo: number; maxRaiseTo: number; canRaise: boolean }`.
- Produces (betting.ts): `legalActions(round: BettingRound, seat: number): LegalActions`; `applyBet(round: BettingRound, seat: number, action: Action): { ok: true; round: BettingRound } | { ok: false; error: string }`; `isRoundComplete(round: BettingRound): boolean`.

- [ ] **Step 1:** Tests: `min raise equals current bet plus last raise size`; `postflop bet minimum is the big blind`; `call amount capped at stack (all-in call)`; `short all-in raise does not reopen raising for players who already acted`; `full all-in raise reopens`; `raise below min and not all-in returns error, round unchanged`; `check illegal when facing a bet`; `round complete when all non-folded, non-all-in players matched current bet and acted`.
- [ ] **Step 2:** Run, expect FAIL. Implement. Run, expect PASS.
- [ ] **Step 3:** Commit `feat(engine): betting rules`.

### Task 6: Hand state machine

**Files:**
- Create: `src/engine/hand.ts`; Test: `tests/engine/hand.test.ts`

**Interfaces:**
- Consumes: Tasks 2-5.
- Produces: `type HandConfig = { seed: number; seats: { id: number; stack: number }[]; buttonSeat: number; smallBlind: number; bigBlind: number }`; `type HandEvent = { type: 'blinds'|'deal'|'street'|'action'|'showdown'|'award'; data: unknown }`; `type HandState` (street, board, seats, pots, toAct, button, log: `{ seat: number; action: Action }[]`, result when done); `createHand(cfg: HandConfig): HandState`; `apply(state: HandState, action: Action): { ok: true; state: HandState; events: HandEvent[] } | { ok: false; error: string }`; `legalFor(state: HandState): LegalActions`; `playerView(state: HandState, seat: number): PlayerView` (own hole cards + public info only); `finalStacks(state: HandState): Map<number, number>`.

- [ ] **Step 1:** Tests: `blinds posted and UTG acts first at 6 players`; `heads-up: button is small blind and acts first preflop` (Review Focus); `short stack posts partial blind and is all-in`; `all fold to one player: wins uncontested, no showdown` (Review Focus); `check-down reaches showdown and awards best hand`; `all-in preflop deals remaining board with no betting` (Review Focus); `total chips before equals total chips after`; `same config and actions replay to identical result`; `playerView hides other seats' hole cards`.
- [ ] **Step 2:** Run, expect FAIL. Implement. Run, expect PASS.
- [ ] **Step 3:** Commit `feat(engine): hand state machine`.

### Task 7: Blinds schedule and game controllers

**Files:**
- Create: `src/engine/blinds.ts`, `src/engine/cashGame.ts`, `src/engine/tournament.ts`; Test: `tests/engine/modes.test.ts`

**Interfaces:**
- Produces: `TOURNAMENT_LEVELS: { sb: number; bb: number }[]` (the ladder in Global Constraints); `levelForHand(handNumber: number): { sb: number; bb: number }` (10 hands per level, last level repeats); `nextButton(seatIds: number[], current: number): number`; `type CashGame`, `newCashGame(playerIds: number[]): CashGame`, `rebuy(g: CashGame, seat: number): CashGame`; `type Tournament`, `newTournament(): Tournament`; both expose `nextHandConfig(g, seed: number): HandConfig` and `settle(g, finalStacks: Map<number, number>)` returning the updated game; `Tournament` additionally exposes `eliminated: number[]` (in bust order), `isOver(t): boolean`, `payouts(t): Map<number, number>` (50/30/20 of 900 to 1st-3rd).

- [ ] **Step 1:** Tests: `levelForHand(1..10) is 10/20 and (11) is 15/30`; `last level repeats past hand 100`; `button skips eliminated seats`; `busted player is removed and ordered in eliminated`; `tournament ends with one player and pays 450/270/180`; `cash rebuy restores 200 stack`; `heads-up button handling works when 2 remain`.
- [ ] **Step 2:** Run, expect FAIL. Implement. Run, expect PASS.
- [ ] **Step 3:** Commit `feat(engine): blinds, cash and tournament controllers`.

### Task 8: Engine property tests

**Files:**
- Create: `tests/engine/property.test.ts`, `src/engine/randomPlayer.ts`

**Interfaces:**
- Produces: `randomLegalAction(state: HandState, rng: () => number): Action` (test helper, only uses `legalFor`).

- [ ] **Step 1:** Tests: `5000 random hands at 2-9 players conserve total chips and never throw`; `every random hand terminates within 200 actions`; `full random tournament always ends with exactly one player holding 13500 chips`; `engine invariant check rejects a hand where pot != sum of contributions` (call `checkInvariants(state): string | null` exported from `hand.ts`).
- [ ] **Step 2:** Run. Fix any engine bugs found (add a regression test per bug). Expect PASS.
- [ ] **Step 3:** Commit `test(engine): property tests and invariants`.

### Task 9: Bots

**Files:**
- Create: `src/bots/ranges.ts`, `src/bots/decide.ts`; Test: `tests/bots/bots.test.ts`

**Interfaces:**
- Consumes: `PlayerView`, `legalFor`, `evaluate`, equity function from Task 10 is NOT used here (bots use a cheap hand-strength heuristic to keep bots independent of `coach`).
- Produces: `type BotStyle = 'tight'|'loose'|'aggressive'`; `preflopRange(style: BotStyle, position: 'EP'|'MP'|'CO'|'BTN'|'SB'|'BB'): Set<string>` (hand classes like `"AKs"`); `decide(view: PlayerView, style: BotStyle, rng: () => number): Action`.

- [ ] **Step 1:** Tests: `1000 decisions per style across random hands are always legal` (via `legalFor`); `tight range is a strict subset of loose range for every position`; `bot folds 72o from UTG and raises AA in every style`; `over 2000 simulated hands tight VPIP < loose VPIP`; `bot with all chips in already never receives a decision` (all-in players are skipped by the session).
- [ ] **Step 2:** Run, expect FAIL. Implement: preflop by range and position, postflop by hand strength plus pot odds with style-specific aggression. Run, expect PASS.
- [ ] **Step 3:** Commit `feat(bots): style-based bots`.

### Task 10: Coach (hint, equity, review)

**Files:**
- Create: `src/coach/potOdds.ts`, `src/coach/equity.ts`, `src/coach/equityWorker.ts`, `src/coach/preflopChart.ts`, `src/coach/hint.ts`, `src/coach/review.ts`; Test: `tests/coach/coach.test.ts`

**Interfaces:**
- Produces: `potOdds(callAmount: number, pot: number): number` (required equity as fraction); `equity(hole: Card[], board: Card[], opponents: number, samples: number, rng: () => number): number` (0..1); `equityWorker.ts` wraps `equity` for `new Worker(...)` with message `{hole, board, opponents, samples}` -> `{equity}`; `preflopAdvice(hole: Card[], position: Position, facing: 'none'|'raise'): 'fold'|'call'|'raise'`; `hint(view: PlayerView, legal: LegalActions, equityValue: number): Hint` where `Hint = { potOdds: number | null; equity: number; preflop?: 'fold'|'call'|'raise'; text: string }`; `reviewHand(log: HandLog): ReviewItem[]` where `ReviewItem = { step: number; seat: number; action: Action; flag: 'ok'|'questionable'; reason: string; equity: number }` (only the human seat is flagged).

- [ ] **Step 1:** Tests: `potOdds(50, 150) === 0.25`; `AA vs 1 random opponent equity within 0.85 +/- 0.03 at 20000 samples`; `AKs vs AKo-less board gives deterministic result with fixed seed`; `call with equity below pot odds is flagged questionable`; `fold with equity above pot odds + 0.15 is flagged questionable`; `reviewHand replays from seed and produces one item per human action`; `hint preflop text matches chart for 72o UTG (fold)`.
- [ ] **Step 2:** Run, expect FAIL. Implement (Monte Carlo, limited samples default 2000). Run, expect PASS.
- [ ] **Step 3:** Commit `feat(coach): hints, equity and hand review`.

### Task 11: Store, stats, resume, export

**Files:**
- Create: `src/store/db.ts`, `src/store/stats.ts`, `src/store/backup.ts`, `src/store/resume.ts`; Test: `tests/store/store.test.ts` (uses `fake-indexeddb`)

**Interfaces:**
- Produces: `type HandLog = { id: string; seed: number; mode: 'cash'|'tournament'; seats: {id:number; stack:number}[]; button: number; blinds: {sb:number; bb:number}; actions: {seat:number; action: Action}[]; humanSeat: number; usedHint: boolean; netBb: number; timestamp: number }`; `saveHand(log: HandLog): Promise<void>`; `listHands(): Promise<HandLog[]>`; `saveSession(s: SessionRecord): Promise<void>` where `SessionRecord = { id: string; mode: 'cash'|'tournament'; place?: number; profitBb: number; endedAt: number }`; `computeStats(hands: HandLog[]): { hands: number; vpip: number; pfr: number; bbPer100: number; showdownWinRate: number }`; `exportBackup(): Promise<string>` (JSON); `importBackup(json: string): Promise<{ ok: boolean; error?: string }>`; `saveResume(state: ResumeState): void`; `loadResume(): ResumeState | null` (returns null on missing, corrupt, or wrong-version data).

- [ ] **Step 1:** Tests: `saved hand round-trips`; `computeStats VPIP counts voluntary preflop money only (blinds excluded)`; `export then import into empty db restores all hands`; `import of invalid JSON returns ok:false and changes nothing`; `loadResume returns null for corrupt JSON and for wrong version` (Review Focus); `write failure is surfaced as a rejected promise, not a throw in the caller` (for the UI warning).
- [ ] **Step 2:** Run, expect FAIL. Implement with `idb`; resume state in `localStorage` with a `version` field. Run, expect PASS.
- [ ] **Step 3:** Commit `feat(store): history, stats, backup, resume`.

### Task 12: Session orchestrator

**Files:**
- Create: `src/session/session.ts`; Test: `tests/session/session.test.ts`

**Interfaces:**
- Consumes: Tasks 6, 7, 9, 11.
- Produces: `type Session`; `createSession(mode: 'cash'|'tournament', deps: { saveHand; saveSession; saveResume; rng: () => number }): Session`; `session.state(): HandState`; `session.humanLegal(): LegalActions | null`; `session.submitHuman(a: Action): Result`; `session.runBotsUntilHuman(): Promise<void>` (skips folded and all-in seats, applies bot actions); `session.nextHand()`; `session.isOver(): boolean`; `session.onChange(cb)`.

- [ ] **Step 1:** Tests: `bots act until the human is to act`; `finishing a hand saves one HandLog with all actions`; `a bot never gets a PlayerView containing other hole cards`; `tournament session ends when human busts or wins and saves a SessionRecord`; `hint use sets usedHint on the saved log`; `save failure sets a warning flag but play continues` (Review Focus-adjacent); `restoring from saved resume state continues the same hand`.
- [ ] **Step 2:** Run, expect FAIL. Implement. Run, expect PASS.
- [ ] **Step 3:** Commit `feat(session): orchestrator`.

### Task 13: UI — table and play flow

**Files:**
- Create: `src/ui/Table.tsx`, `src/ui/ActionBar.tsx`, `src/ui/CardView.tsx`, `src/ui/Lobby.tsx`, `src/ui/HintPanel.tsx`; Modify: `src/ui/App.tsx`; Test: `tests/ui/play.test.tsx` (Vitest + Testing Library)

**Interfaces:**
- Consumes: `Session`, `hint`, `equityWorker`.
- Produces: routes `lobby`, `table`, `stats`, `review` in `App`; `ActionBar` only renders buttons derived from `humanLegal()` with a raise slider clamped to `[minRaiseTo, maxRaiseTo]`.

- [ ] **Step 1:** Tests: `lobby starts a cash game and shows 6 seats`; `lobby starts a tournament and shows 9 seats`; `action bar shows no Check when facing a bet`; `playing check/call to the end of a hand shows the result`; `hint panel is hidden until toggled and toggling it marks the hand as hint-used`; `save warning banner appears when saving fails`.
- [ ] **Step 2:** Run, expect FAIL. Implement; equity requested from the worker, hint shows "calculating" until it returns. Run, expect PASS.
- [ ] **Step 3:** Run `npm run dev` and play one cash hand and one tournament hand in the browser; confirm layout at desktop and phone widths.
- [ ] **Step 4:** Commit `feat(ui): table and play flow`.

### Task 14: UI — stats, history, review, backup

**Files:**
- Create: `src/ui/StatsPage.tsx`, `src/ui/HandList.tsx`, `src/ui/ReviewPage.tsx`; Test: `tests/ui/review.test.tsx`

**Interfaces:**
- Consumes: `listHands`, `computeStats`, `reviewHand`, `exportBackup`, `importBackup`.

- [ ] **Step 1:** Tests: `stats page shows VPIP, PFR, bb/100 for saved hands`; `hand list tags hint-used hands`; `review page steps through actions and highlights questionable decisions`; `review page shows the "not GTO" disclaimer`; `import of a bad file shows an error and keeps existing history`.
- [ ] **Step 2:** Run, expect FAIL. Implement. Run, expect PASS.
- [ ] **Step 3:** Run the full suite (`npm test`) and `npm run build`; play a short tournament to the end in the browser and open its review. Expected: all green, no console errors.
- [ ] **Step 4:** Commit `feat(ui): stats, history, review, backup`.

---

## Self-review notes
- Spec coverage: engine modules (T2-7), invariants/property tests (T8), bots (T9), hint + review (T10), IndexedDB/stats/export/resume (T11), data flow (T12), UI + error warnings (T13-14). Cash rebuy, tournament payouts, seeded replay, hint tagging, and the "not GTO" notice each have a test.
- Type names (`Action`, `HandState`, `PlayerView`, `LegalActions`, `HandLog`) are defined once and reused unchanged.
