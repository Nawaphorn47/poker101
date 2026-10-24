# Poker Trainer Phase 3 (Calculator Tools) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four calculator tools (pot odds + outs, ICM, equity, heads-up push/fold chart) behind one Tools page, each result labelled exact / model / estimate.

**Architecture:** Pure calculation modules in `src/tools/` (validated, never throwing on user input), a worker-based runner for the equity simulation, and small React panels in `src/ui/tools/` under a tabbed `ToolsPage`.

**Tech Stack:** TypeScript, React, Vite, Vitest (all already in the repo); Web Worker for the equity simulation.

**Spec:** `docs/superpowers/specs/2026-10-24-poker-trainer-tools-design.md` (builds on phase 1 and 2a, merged on `master`).

## Global Constraints

- No backend, no accounts, nothing entered is saved. Hold'em no-limit.
- Layering: `tools` depends on `engine`, `drill/oddsMath` and `drill/pushFoldData` only; `ui` calls `tools`. No changes to `engine`, `bots`, `session`, or the database.
- Calculation functions validate input and return an error value; they never throw on user input (the chart takes a slider value and may throw for out-of-range, like `pushFoldRow`).
- Certainty labels: pot odds `Exact`, ICM `Model`, equity `Exact` when 0/1/2 board cards are still to come and `Estimate ±x%` when simulated, chart `Exact` is NOT used: chart says "heads-up only, ±1% simulation error, ignores card removal".
- Pot odds: pot after the bet = pot before + bet; call = bet; required equity = call / (pot after + call); next-card equity = outs / 47 (flop) or / 46 (turn); by-river equity (flop only) = 1 − C(47−outs, 2) / C(47, 2); EV = equity × pot after − (1 − equity) × call; verdict uses the next-card EV; outs integer 0–20, pot ≥ 0, bet > 0.
- ICM: Malmuth-Harville, 2–10 stacks (> 0), 1–5 payouts (≥ 0, not more payouts than players); at most 10·9·8·7·6 = 30,240 ordered sequences.
- Equity: 2–6 players, two distinct cards each; board of 0, 3, 4 or 5 cards (1 or 2 rejected); no duplicate card anywhere; ties split equally; exact enumeration when 0, 1 or 2 cards are to come (at most 990 boards); simulation when 5 are to come, capped at `min(200000, floor(1200000 / players))` samples, partial result about every 20,000 samples, 95% margin 1.96 × √(p(1−p)/n); cancelled when input changes; worker failure falls back to a smaller main-thread simulation and says so.
- Chart: 13×13, pairs on the diagonal, suited above it, offsuit below, stack whole number 2–15, borderline = EV difference under 0.1bb.
- Out of scope: ranges in equity, exact preflop enumeration, ICM in the chart, saved calculation history.

## Review Focus

- ICM extremes: stacks 1,000,000 : 1, equal stacks, payout list containing zeros, exactly 2 players with 2 payouts.
- Equity: three players split on a board that plays (each 1/3); the same card in a hand and on the board; a board of exactly 1 or 2 cards.
- Pot odds: outs 0; pot before the bet of 0 (required equity 50%); river street with outs entered.
- Equity race: editing a card while a simulation runs must never display the old simulation's result afterwards.
- Chart boundaries: stacks 2 and 15; SB and BB views; AKs above the diagonal and AKo below.

---

### Task 1: Pot odds report

**Files:**
- Create: `src/tools/potOdds.ts`; Test: `tests/tools/potOdds.test.ts`

**Interfaces:**
- Consumes: `requiredEquity`, `nextCardEquity`, `outsEquity`, `evCall` from `src/drill/oddsMath`.
- Produces: `type PotOddsInput = { potBefore: number; bet: number; outs: number; street: 'flop' | 'turn' | 'river' }`; `type PotOddsReport = { ok: true; potAfter: number; requiredEquity: number; nextCard?: { equity: number; ev: number }; byRiver?: { equity: number; ev: number }; verdict: 'call' | 'fold' | null; disagreement: boolean } | { ok: false; error: string }`; `potOddsReport(input: PotOddsInput): PotOddsReport` (river: no `nextCard`/`byRiver`, verdict null; `byRiver` only on the flop; `disagreement` true when the sign of the two EVs differs).

- [ ] **Step 1:** Tests: `pot 100 bet 100 flop 9 outs: required 0.3333, next-card 9/47, by-river 0.3497, verdict fold, disagreement true`; `turn 9 outs pot 100 bet 25: next-card 9/46, no byRiver, verdict call`; `river returns required equity only and verdict null`; `outs 0 gives equity 0 and fold`; `pot before 0 gives required equity 0.5`; `bet 0, negative pot, outs 1.5 and outs 21 return ok:false with a message`; `values agree with drill/oddsMath for 200 random inputs`.
- [ ] **Step 2:** Run `npx vitest run tests/tools/potOdds.test.ts`, expect FAIL (module missing). Implement. Run, expect PASS.
- [ ] **Step 3:** Commit `feat(tools): pot odds report`.

### Task 2: ICM

**Files:**
- Create: `src/tools/icm.ts`; Test: `tests/tools/icm.test.ts`

**Interfaces:**
- Produces: `type IcmResult = { ok: true; values: number[]; shares: number[]; chipShares: number[] } | { ok: false; error: string }`; `icmEquities(stacks: number[], payouts: number[]): IcmResult` (`values` = prize value per player, `shares` = value ÷ total payouts, `chipShares` = stack ÷ total stacks).

- [ ] **Step 1:** Tests (compare against a brute-force implementation inside the test that enumerates every finishing order for up to 4 players): `3 players stacks [50,30,20] payouts [50,30,20] equals brute force`; `4 players with payouts [50,30,20] equals brute force`; `equal stacks give equal values`; `values sum to the total payouts`; `winner-take-all payouts give value proportional to stack`; `the chip leader's share is below its chip share when payouts are flat-ish` (stacks [70,20,10], payouts [50,30,20]); Review Focus: `stacks 1000000:1 give finite values summing to the pool`, `2 players with 2 payouts [60,40]`, `payouts containing zeros [100,0,0]`; errors: `1 player, 11 players, a stack of 0, a negative payout, more payouts than players, 6 payouts` each return ok:false.
- [ ] **Step 2:** Run, expect FAIL. Implement the recursive sequence enumeration over the paid places only. Run, expect PASS.
- [ ] **Step 3:** Commit `feat(tools): ICM`.

### Task 3: Equity core

**Files:**
- Create: `src/tools/equity.ts`; Test: `tests/tools/equity.test.ts`

**Interfaces:**
- Consumes: `evaluate`, `compareScores`, `Card`, `mulberry32`.
- Produces: `type EquityInput = { hands: Card[][]; board: Card[] }`; `type PlayerEquity = { win: number; tie: number; equity: number }` (fractions); `type EquityResult = { ok: true; players: PlayerEquity[]; exact: boolean; samples: number; margin?: number[] } | { ok: false; error: string }`; `validateEquityInput(input: EquityInput): string | null`; `enumerateEquity(input: EquityInput): EquityResult` (board of 3–5 cards, exact); `createSimulation(input: EquityInput, rng: () => number): { step(samples: number): void; result(): EquityResult }` (`result().margin` = 95% margin per player); `samplesFor(players: number): number`.

- [ ] **Step 1:** Tests: `validate rejects fewer than 2 or more than 6 players, hands without two cards, a board of 1 or 2 cards, and a card repeated between a hand and the board or between hands`; `a full board where AA beats KK gives equity 1 and 0, exact true`; `a board that plays gives each of 3 players 1/3` (Review Focus); `turn board enumeration equals an independent enumeration written in the test (evaluate each of the remaining river cards)`; `flop board enumeration equals an independent two-card enumeration`; `equities always sum to 1`; `win + tie share equals equity` for each player; `samplesFor(2) is 200000, samplesFor(6) is 200000 and samplesFor(10) is 120000`; `simulation of AA vs KK preflop with 100000 samples is within 0.02 of 0.82 and within the reported margin plus 0.005`; `same seed gives identical simulation results`; `margin shrinks as samples grow`.
- [ ] **Step 2:** Run, expect FAIL. Implement (enumerate completions of the unseen cards; the simulation draws the missing board cards by partial shuffle). Run, expect PASS.
- [ ] **Step 3:** Commit `feat(tools): equity core`.

### Task 4: Equity runner with worker and fallback

**Files:**
- Create: `src/tools/equityToolWorker.ts`, `src/tools/equityRunner.ts`; Test: `tests/tools/equityRunner.test.ts`

**Interfaces:**
- Consumes: Task 3.
- Produces: `type RunHandle = { stop(): void }`; `startEquity(input: EquityInput, onUpdate: (r: EquityResult, done: boolean) => void, opts?: { useWorker?: boolean; seed?: number }): RunHandle` (board of 3–5 cards: exact result delivered once with `done: true`; no board: partial results about every 20,000 samples then `done: true`; invalid input: one `ok:false` update with `done: true`; after `stop()` no further `onUpdate` calls). The worker file receives `{ input, seed, cap }` and a `{ type: 'stop' }` message and posts `{ result, done }` using chunks with a yield between them. Without `Worker` (or `useWorker: false`, or the worker raising an error) the runner simulates on the main thread in chunks with `setTimeout`, with half the cap, and every update on that path passes a third argument `note` ("Simulated on the main thread with fewer samples") to `onUpdate(r, done, note?)`.

- [ ] **Step 1:** Tests (main-thread path, `useWorker: false`): `a flop board delivers exactly one update with done true and exact true`; `an invalid input delivers one ok:false update`; `a preflop run delivers several partial updates then a done update whose sample count equals the cap`; `stop() prevents any later update`; `a second startEquity after stop() is unaffected by the first` (Review Focus: no stale results); `the fallback note is present on the main-thread path when useWorker is omitted and Worker is undefined`.
- [ ] **Step 2:** Run, expect FAIL. Implement. Run, expect PASS. Run `npm run build` to confirm the worker file compiles.
- [ ] **Step 3:** Commit `feat(tools): equity runner and worker`.

### Task 5: Push/fold chart data

**Files:**
- Create: `src/tools/chart.ts`; Test: `tests/tools/chart.test.ts`

**Interfaces:**
- Consumes: `pushFoldRow`, `ALL_CLASSES`.
- Produces: `type ChartCell = { name: string; row: number; col: number; action: 'push' | 'call' | 'fold'; ev: number; foldEv: number; borderline: boolean }`; `type Chart = { cells: ChartCell[]; pct: number; role: 'sb' | 'bb'; stack: number }`; `chartFor(stack: number, role: 'sb' | 'bb'): Chart` (169 cells; row and col 0..12 with A = 0; pairs where row === col, suited where row < col, offsuit where row > col; `pct` = percentage of the 1326 combinations whose action is not fold; throws for stacks outside 2–15 or not whole).

- [ ] **Step 1:** Tests: `169 cells with unique names and unique (row, col)`; `AA at (0,0), AKs at (0,1), AKo at (1,0), 32s at (11,12), 32o at (12,11)` (Review Focus); `cell action matches membership in pushFoldRow(stack).push (sb) or .call (bb)` for all stacks and both roles; `ev matches evPush (sb) or evCall (bb)`; `foldEv is -0.5 for sb and -1 for bb`; `borderline exactly when |ev - foldEv| < 0.1`; `pct at 2bb sb is about 90.3, at 10bb sb about 57.8 (±0.1)`; `stacks 1, 16, 2.5, NaN throw`.
- [ ] **Step 2:** Run, expect FAIL. Implement. Run, expect PASS.
- [ ] **Step 3:** Commit `feat(tools): push/fold chart data`.

### Task 6: Tools page shell, CardPicker, navigation

**Files:**
- Create: `src/ui/CardPicker.tsx`, `src/ui/ToolsPage.tsx`; Modify: `src/ui/Lobby.tsx` (prop `onTools: () => void`, button "Tools"), `src/ui/App.tsx` (screen `'tools'`), `src/ui/styles.css`; Test: `tests/ui/toolsShell.test.tsx`

**Interfaces:**
- Produces: `CardPicker({ value: Card | null; used: Card[]; label: string; onChange: (c: Card | null) => void })` (a button showing the card or "+"; opening it shows a 4×13 grid where cards in `used` (other than `value`) are disabled; choosing selects, a Clear button empties); `ToolsPage({ onBack })` with `role="tablist"` tabs "Pot odds", "ICM", "Equity", "Push/fold chart"; every panel stays mounted and inactive ones carry the `hidden` attribute so their inputs persist across tab switches. Panels are imported from `src/ui/tools/` (created in Tasks 7–9; this task renders temporary stubs that Tasks 7–9 replace).

- [ ] **Step 1:** Tests: `the lobby has a Tools button that opens the tools page`; `the four tabs exist and the first is selected`; `switching tabs shows the chosen panel and hides the others`; `a value typed into a panel input survives switching away and back` (use a stub input in the Pot odds stub that Task 7 keeps); `CardPicker disables cards listed in used but not its own current value`; `CardPicker onChange receives the chosen card and null on Clear`.
- [ ] **Step 2:** Run, expect FAIL. Implement. Run, expect PASS. Run `npm test` and `npm run build`.
- [ ] **Step 3:** Commit `feat(ui): tools page shell and card picker`.

### Task 7: Pot odds and ICM panels

**Files:**
- Create: `src/ui/tools/PotOddsPanel.tsx`, `src/ui/tools/IcmPanel.tsx`; Modify: `src/ui/ToolsPage.tsx`; Test: `tests/ui/toolsPanels.test.tsx`

**Interfaces:**
- Consumes: `potOddsReport`, `icmEquities`.
- Produces: `PotOddsPanel()` (fields: pot before the bet, bet, outs, street select; shows required equity, next-card and by-river equity and EV, verdict, and the "only worthwhile if no more bets follow" note when `disagreement`; badge `Exact`; field errors in `role="alert"`); `IcmPanel()` (rows of stack inputs with add/remove (2–10) and payout inputs with add/remove (1–5); shows value, share of pool and chip share per player; badge `Model` plus the note that it ignores skill and blind pressure; errors in `role="alert"`).

- [ ] **Step 1:** Tests: `pot odds shows required equity 33.3% and the disagreement note for pot 100, bet 100, 9 outs on the flop`; `an invalid bet of 0 shows an alert and no result`; `the Exact badge appears with a valid result`; `ICM shows values for 3 stacks and payouts and the Model badge`; `removing a player below 2 is not possible (remove disabled)`; `a zero stack shows an alert and no values`.
- [ ] **Step 2:** Run, expect FAIL. Implement. Run, expect PASS.
- [ ] **Step 3:** Commit `feat(ui): pot odds and ICM panels`.

### Task 8: Equity panel

**Files:**
- Create: `src/ui/tools/EquityPanel.tsx`; Modify: `src/ui/ToolsPage.tsx`; Test: `tests/ui/equityPanel.test.tsx`

**Interfaces:**
- Consumes: `startEquity`, `validateEquityInput`, `CardPicker`.
- Produces: `EquityPanel({ run?: typeof startEquity })` (default `startEquity`; injectable for tests): 2–6 players each with two `CardPicker`s, a 5-slot board, add/remove player. Calculation starts automatically whenever the input is valid; any change stops the previous run first and clears its result. Messages: "Pick both cards for every player" when incomplete, the validation message otherwise (board of 1–2 cards: "The board needs 0, 3, 4 or 5 cards"). Result table: win %, tie %, equity % per player; badge `Exact` or `Estimate ±x%` (largest margin) with a "Stop" button and a sample count while running; the fallback note when present.

- [ ] **Step 1:** Tests (fake `run`): `a valid flop input calls run once and shows the equities with the Exact badge`; `an incomplete hand shows the pick-both-cards message and does not call run`; `a board of 2 cards shows the board message`; `a duplicate card cannot be chosen twice`; `changing a card stops the previous run and a late update from the old run is never shown` (Review Focus); `a simulated partial update shows the Estimate badge with the margin and a Stop button, and Stop calls handle.stop`; `the fallback note is shown when the run supplies one`.
- [ ] **Step 2:** Run, expect FAIL. Implement. Run, expect PASS.
- [ ] **Step 3:** Commit `feat(ui): equity panel`.

### Task 9: Chart panel and final checks

**Files:**
- Create: `src/ui/tools/ChartPanel.tsx`; Modify: `src/ui/ToolsPage.tsx`, `src/ui/styles.css`; Test: `tests/ui/chartPanel.test.tsx`

**Interfaces:**
- Consumes: `chartFor`.
- Produces: `ChartPanel()`: stack slider 2–15 (default 10), role toggle (SB pushes / BB calls), 13×13 grid of buttons labelled by hand name with class `push`/`call`/`fold` and `borderline`; selecting or hovering a cell shows `<name>: EV <x> bb vs fold <y> bb, best: <action>`; summary line `<pct>% of combinations`; note "Heads-up only, about ±1% simulation error, ignores card removal".

- [ ] **Step 1:** Tests: `renders 169 cells`; `AA and AKs and AKo are in the expected grid positions`; `changing the slider changes the summary percentage`; `toggling to BB changes the summary and cell classes`; `selecting a cell shows its EV text`; `the heads-up note is present`.
- [ ] **Step 2:** Run, expect FAIL. Implement. Run, expect PASS. Run the whole suite (`npm test`) and `npm run build`, expect all green.
- [ ] **Step 3:** Open each tool in the browser (`npm run dev`): enter a pot odds case, a 3-player ICM, a flop equity and a preflop equity (confirm the Estimate badge, Stop, and no console errors), and the chart at 2bb and 15bb. Commit `feat(ui): push/fold chart panel`.

---

## Self-review notes
- Spec coverage: pot odds (T1, T7), ICM (T2, T7), equity exact + simulation + cancellation + fallback (T3, T4, T8), chart (T5, T9), navigation, picker and tab persistence (T6), certainty labels (T7–T9), validation messages (T1–T3, T7–T8). The "regression: phase 1 and 2a suites" is covered by running the full suite at the end of T6 and T9.
- Names reused unchanged across tasks: `EquityInput`, `EquityResult`, `startEquity`, `potOddsReport`, `icmEquities`, `chartFor`, `CardPicker`.
- Proportion: the spec is 100 lines and this plan is about 150, mostly test names and signatures, no function bodies.
