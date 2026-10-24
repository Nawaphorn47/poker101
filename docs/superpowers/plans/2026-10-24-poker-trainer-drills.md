# Poker Trainer Phase 2a (Drills) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A drill mode with three question types (pot odds/equity, preflop by position, heads-up push/fold), feedback with honest certainty labels and EV where exact, and persisted progress that weights missed questions.

**Architecture:** Pluggable `DrillModule`s (`generate` + `grade`) in `src/drill/`, a runner that builds weighted 10-question sets, a new IndexedDB store for results, and one `DrillPage` in the UI. Heads-up push/fold data is a Nash table computed once by a build script and committed as JSON.

**Tech Stack:** TypeScript, React, Vite, Vitest, idb (all already in the repo); `vite-node` (ships with Vitest) for the build script.

**Spec:** `docs/superpowers/specs/2026-10-24-poker-trainer-drills-design.md` (builds on the phase 1 spec and code already on `master`).

## Global Constraints

- Hold'em no-limit, play money, no backend, no accounts; results stay in the browser.
- Layering: `drill` depends on `engine` and `coach` only (not `bots`, not `session`); `ui` calls `drill`; `store` gains one object store.
- EV is shown only where computed exactly (odds drills, heads-up push/fold). Preflop drill never returns an `ev`.
- Certainty label: `'exact'` for odds and push/fold, `'approximate'` for preflop ("Guideline, not GTO").
- Odds equity is computed by counting outs, never by simulating against a random hand. EV(call) = equity × pot − (1 − equity) × call, with `pot` including the opponent's bet; EV(fold) = 0.
- Preflop: stack depth not shown, deep-stack assumption (~100bb); borderline = Chen score within 1 of the relevant threshold, both adjacent answers accepted.
- Push/fold: heads-up only, SB stack 2–15bb in whole numbers. EV in bb relative to hand start: SB fold −0.5; SB push = (1 − c) × 1 + c × (2·eq·S − S); BB fold −1; BB call = 2·eq·S − S. An answer is correct when its EV is within 0.1bb of the best; borderline when correct but not the best.
- Database version becomes 2, adding only `drillResults`; `hands` and `sessions` untouched. Backup version becomes 2; version 1 files still import.
- Question set size is 10. Weighting: 5 candidates per slot, pick with probability proportional to `1 + 3 × missRate(key)`.
- A failed result save must not stop the drill; show "this answer was not saved".
- Out of scope: postflop (2b), multi-way push/fold, importing user range files (only the `RangeSource` interface), drills generated from phase 1 mistakes.

## Review Focus

- Odds: a bet larger than the pot (required equity above 50%), and outs at the extremes (1 and 15+) must give valid probabilities and sensible options.
- Generated hole cards must be two distinct valid cards, and the hand class label must match the cards (pairs, suited, offsuit).
- Opening a version 1 database (with hands) must upgrade to version 2 keeping every hand; a version 1 backup file must still import.
- First run with no drill history, and history where every answer for one key was wrong, must both produce full 10-question sets.
- Push/fold at the stack extremes (2bb and 15bb) and BB at 2bb: no NaN or missing data, BB calls nearly everything at 2bb.

---

### Task 1: Drill types and odds math

**Files:**
- Create: `src/drill/types.ts`, `src/drill/oddsMath.ts`; Test: `tests/drill/oddsMath.test.ts`

**Interfaces:**
- Produces (types.ts): `type DrillId = 'odds' | 'preflop' | 'pushfold'`; `type Option = { value: string; label: string }`; `type Question<S = unknown> = { type: DrillId; level: number; key: string; prompt: string; options: Option[]; scenario: S }`; `type Grade = { correct: boolean; borderline: boolean; explanation: string; certainty: 'exact' | 'approximate'; ev?: { chosen: number; best: number; unit: 'chips' | 'bb' } }`; `interface DrillModule { id: DrillId; levels: number; generate(rng: () => number, level: number): Question; grade(q: Question, answer: string): Grade }`.
- Produces (oddsMath.ts): `requiredEquity(call: number, pot: number): number` (pot includes opponent's bet; same as `coach/potOdds`); `outsEquity(outs: number, street: 'flop' | 'turn'): number` (flop: by the river, 47 unseen; turn: one card, 46 unseen); `ruleOfEstimate(outs: number, street: 'flop' | 'turn'): number` (outs × 4 on the flop, × 2 on the turn, as a fraction); `evCall(equity: number, pot: number, call: number): number`.

- [ ] **Step 1:** Tests: `requiredEquity(50, 150) is 0.25`; `bet larger than pot needs more than 50%` (`requiredEquity(200, 100) > 0.5`); `outsEquity(9, 'flop') is 0.3497 within 0.001`; `outsEquity(9, 'turn') is 0.1957 within 0.001`; `outsEquity(0, 'flop') is 0`; `outsEquity(1, 'turn') equals 1/46`; `ruleOfEstimate(9,'flop') is 0.36`; `evCall(0.25, 150, 50) is 0` (break-even); `evCall(0.4, 100, 50) is 25`.
- [ ] **Step 2:** Run `npx vitest run tests/drill/oddsMath.test.ts`, expect FAIL (module missing). Implement the four functions with a `choose(n, k)` helper. Run, expect PASS.
- [ ] **Step 3:** Commit `feat(drill): types and odds math`.

### Task 2: Odds drill module

**Files:**
- Create: `src/drill/modules/oddsDrill.ts`; Test: `tests/drill/oddsDrill.test.ts`

**Interfaces:**
- Consumes: `DrillModule`, `Question`, `Grade`, Task 1 math.
- Produces: `oddsDrill: DrillModule` (id `'odds'`, `levels: 3`). Scenario type `OddsScenario = { variant: 'required' | 'outs' | 'callfold'; pot: number; call?: number; outs?: number; street?: 'flop' | 'turn' }`. Option values are strings: level 1 percentages (`"25"`), level 2 percentages, level 3 `'call' | 'fold'`. Keys: `odds:L1`, `odds:L2:<street>:<outs>`, `odds:L3:<street>`.

- [ ] **Step 1:** Tests: `level 1 correct option equals round(requiredEquity*100)` for 200 seeds; `level 1 has 4 distinct options at least 10 points apart`; `level 2 exactly one option is within 5 points of exact outs equity` (and its grade is correct, others incorrect) for 200 seeds; `level 2 option exactly 5 points away is correct, 5.1 away is incorrect` (grade called with a hand-built question); `level 3 grade is call exactly when EV(call) > 0 and carries ev {chosen, best, unit: 'chips'}`; `all grades have certainty exact and borderline false`; `same rng state gives same question`; Review Focus: `bet larger than the pot at level 1 yields a required equity above 50 and still four options`; `outs of 1 and 15 produce options within 0..100`.
- [ ] **Step 2:** Run, expect FAIL. Implement `generate` (levels as in Interfaces; outs drawn 1–15; pot 20–200 and bet 0.25–1.5× pot rounded to whole chips; distractor percentages built by offsets of ±10/±20 points clamped to 1–99, deduplicated) and `grade` (level 1: correct when option equals the right percentage; level 2: within 5 points of `outsEquity`; level 3: compare against EV sign; `ev.chosen` = EV of the chosen option, `ev.best` = max(EV(call), 0)). Explanations state the formula used and that later betting rounds are not included. Run, expect PASS.
- [ ] **Step 3:** Commit `feat(drill): odds drill`.

### Task 3: Preflop range source and drill

**Files:**
- Create: `src/drill/rangeSource.ts`, `src/drill/modules/preflopDrill.ts`; Modify: `src/coach/preflopChart.ts` (export `openMin(position: Position): number` and `PREMIUM_SCORE = 12`, no behaviour change); Test: `tests/drill/preflopDrill.test.ts`

**Interfaces:**
- Consumes: `preflopAdvice`, `chenScore`, `handClass`, `Position`, `parseCard`.
- Produces (rangeSource.ts): `type PreflopAction = 'fold' | 'call' | 'raise'`; `interface RangeSource { advise(hole: Card[], position: Position, facing: 'none' | 'raise'): { best: PreflopAction; acceptable: PreflopAction[] } }`; `builtInRanges: RangeSource` (acceptable = best plus the neighbouring action when the Chen score is within 1 of that boundary; boundaries: facing none → `openMin(position)`; facing raise → `openMin(position) + 2` for fold/call and `PREMIUM_SCORE` for call/raise).
- Produces (preflopDrill.ts): `makePreflopDrill(source: RangeSource): DrillModule` and `preflopDrill = makePreflopDrill(builtInRanges)` (id `'preflop'`, `levels: 1`). Scenario `{ hole: Card[]; position: Position; facing: 'none' | 'raise' }`; options fold/call/raise; key `preflop:<position>:<facing>:<handClass>`; grades have `certainty: 'approximate'` and never an `ev`.

- [ ] **Step 1:** Tests: `AA advises raise from every position and facing` ; `72o from EP facing none is fold with acceptable only fold`; `hand one point above the open threshold is raise with fold also acceptable` and `hand two points above is raise only` (find hands by scanning `ALL_CLASSES`); `grade marks borderline when the chosen answer is acceptable but not best`; `limping (call) with facing none is incorrect for a clear raise`; `generate yields two distinct valid cards and a key whose hand class matches handClass(hole)` for 500 seeds (Review Focus); `no grade carries ev`; `makePreflopDrill accepts a custom RangeSource` (stub that always says fold).
- [ ] **Step 2:** Run, expect FAIL. Implement. Hand generation: draw two distinct cards from `shuffledDeck(rng-derived seed)`. Run, expect PASS; run the existing coach tests to confirm `preflopChart` behaviour is unchanged.
- [ ] **Step 3:** Commit `feat(drill): preflop drill and range source`.

### Task 4: Push/fold Nash solver

**Files:**
- Create: `src/drill/pushFoldSolver.ts`; Test: `tests/drill/pushFoldSolver.test.ts`

**Interfaces:**
- Produces: `type SolveInput = { equity: number[][]; weights: number[]; stack: number }` (`equity[i][j]` = equity of class i against class j with ties counted half, so `equity[j][i] = 1 - equity[i][j]`; `weights` are combination counts; card removal between classes is ignored, ruled once for the whole feature); `type SolveResult = { push: boolean[]; call: boolean[]; evPush: number[]; evCall: number[]; iterations: number }` (`evPush[i]` = SB EV of pushing class i, `evCall[j]` = BB EV of calling with class j, both in bb); `solvePushFold(input: SolveInput, maxIterations?: number): SolveResult` (default 200; alternates best responses starting from "SB pushes everything"; stops when neither range changes).

- [ ] **Step 1:** Tests using a synthetic 6-class matrix where `equity[i][j] = clamp(0.5 + 0.4*(s_i - s_j), 0.02, 0.98)` for ascending strengths: `a class pushes exactly when evPush > -0.5` ; `push set is upward closed in strength` (if class i pushes, every stronger class pushes); `call set is upward closed`; `at a large stack the push set is a strict subset of the push set at a small stack`; `at stack 2 every class pushes`; `converges before maxIterations on the synthetic matrix`; `no NaN or Infinity in any EV`; `BB calling EV formula: evCall[j] equals 2*eq*S - S for a hand-computed single-class range`.
- [ ] **Step 2:** Run, expect FAIL. Implement per Global Constraints formulas: given call set C, `c = Σ_{j∈C} w_j / Σ w`, `eqPush_i = Σ_{j∈C} w_j·equity[i][j] / Σ_{j∈C} w_j` (when C is empty, every class pushes and `evPush = 1`); given push set P, `evCall_j = 2·(Σ_{i∈P} w_i·equity[j][i] / Σ_{i∈P} w_i)·S − S` (when P is empty, nobody calls); push when `evPush_i > −0.5`; call when `evCall_j > −1`. Run, expect PASS.
- [ ] **Step 3:** Commit `feat(drill): push/fold nash solver`.

### Task 5: Equity matrix build script and committed data

**Files:**
- Create: `scripts/build-pushfold.ts`, `src/drill/data/pushFold.json`, `src/drill/pushFoldData.ts`; Modify: `package.json` (script `"build:pushfold": "vite-node scripts/build-pushfold.ts"`); Test: `tests/drill/pushFoldData.test.ts`

**Interfaces:**
- Consumes: `solvePushFold`, `ALL_CLASSES`, `evaluate`/`compareScores`, `mulberry32`.
- Produces (pushFoldData.ts): `type PushFoldRow = { push: string[]; call: string[]; evPush: Record<string, number>; evCall: Record<string, number> }`; `pushFoldRow(stack: number): PushFoldRow` (throws for stacks outside 2–15); `PUSHFOLD_STACKS: number[]` (2..15).
- JSON shape: `{ "version": 1, "samplesPerPair": number, "seed": number, "stacks": { "2": PushFoldRow, ... "15": PushFoldRow } }`, EVs rounded to 3 decimals.

- [ ] **Step 1:** Write `tests/drill/pushFoldData.test.ts` first, expecting FAIL (data missing): `has rows for every stack 2..15 and only those`; `pushFoldRow(1) and pushFoldRow(16) throw`; `AA and KK are in push at every stack and AA is in call at every stack`; `push set size never grows by more than 2 classes as the stack grows` (monotone within noise); `at 2bb the push set has at least 160 of 169 classes`; `at 15bb the push set has fewer than 100 classes`; `evPush for AA exceeds -0.5 at every stack`; `at 2bb the BB call set has at least 150 classes` (Review Focus); `every EV is a finite number and every class name is one of the 169 valid names`.
- [ ] **Step 2:** Implement `scripts/build-pushfold.ts`: for every class pair `i <= j` estimate `equity[i][j]` by Monte Carlo (2500 samples, seed 20261024; each sample picks a random concrete combination of each class without shared cards, deals a random 5-card board from the rest, ties count half), set `equity[j][i] = 1 - equity[i][j]`, `equity[i][i] = 0.5`; weights 6/4/12 for pair/suited/offsuit; solve stacks 2..15; write the JSON with progress lines to stdout. Implement `pushFoldData.ts` reading the JSON.
- [ ] **Step 3:** Run `npm run build:pushfold` in the background (expected to take several minutes; it only needs to complete once). Then run the data tests, expect PASS. If a plausibility test fails, investigate the solver or sample count before touching test thresholds.
- [ ] **Step 4:** Commit `feat(drill): push/fold nash data and build script` (the JSON is committed).

### Task 6: Push/fold drill module

**Files:**
- Create: `src/drill/modules/pushFoldDrill.ts`; Test: `tests/drill/pushFoldDrill.test.ts`

**Interfaces:**
- Consumes: `pushFoldRow`, `handClass`, `ALL_CLASSES`.
- Produces: `pushFoldDrill: DrillModule` (id `'pushfold'`, `levels: 3`: 1 = SB only, 2 = BB facing a push only, 3 = both). Scenario `{ role: 'sb' | 'bb'; stack: number; hole: Card[] }`; options `push`/`fold` for SB, `call`/`fold` for BB; key `pushfold:<role>:<bucket>` with bucket `2-5`, `6-10` or `11-15`.

- [ ] **Step 1:** Tests: `best answer matches membership in the push (or call) set of the data`; `grade uses ev {chosen, best, unit 'bb'} from the data`; `the worse answer within 0.1bb of the best is correct and borderline`; `the worse answer further than 0.1bb is incorrect and not borderline`; `certainty is exact`; `explanation mentions heads-up and the 0.1bb tolerance`; `stack is a whole number between 2 and 15 for 500 seeds at each level`; `hole is two distinct cards` for 500 seeds; `at stack 2 and 15 grading never yields NaN` (Review Focus); `level 1 produces only SB questions, level 2 only BB`.
- [ ] **Step 2:** Run, expect FAIL. Implement: choose a class weighted by combos, pick concrete suits, grade by comparing `evPush[class]` with −0.5 (SB) or `evCall[class]` with −1 (BB). Run, expect PASS.
- [ ] **Step 3:** Commit `feat(drill): push/fold drill`.

### Task 7: Results store, database v2, progress

**Files:**
- Modify: `src/store/db.ts`; Create: `src/drill/progress.ts`; Test: `tests/store/drillStore.test.ts`, `tests/drill/progress.test.ts`

**Interfaces:**
- Produces (db.ts): `type DrillResult = { id: string; type: DrillId; level: number; key: string; correct: boolean; borderline: boolean; evLoss?: number; timestamp: number }`; `saveDrillResult(r: DrillResult): Promise<void>`; `listDrillResults(): Promise<DrillResult[]>` (oldest first, skips records that fail a shape check); `clearAll()` also clears `drillResults`; database opens at version 2 with upgrade creating `drillResults` only when missing.
- Produces (progress.ts): `summarise(results: DrillResult[]): { total: number; correct: number; byType: Record<DrillId, { total: number; correct: number; accuracy: number }> }`; `missRates(results: DrillResult[]): Map<string, number>` (misses ÷ attempts per key; borderline-correct counts as a hit).

- [ ] **Step 1:** Tests: `a version 1 database with saved hands opens at version 2 with every hand intact` (build the v1 database with `idb` directly, then import `src/store/db` via `vi.resetModules()` + dynamic import) (Review Focus); `saved drill result round-trips`; `a stored record with the wrong shape is skipped by listDrillResults`; `summarise returns zeros and accuracy 0 for no results`; `summarise computes accuracy per type`; `missRates gives 0.5 for one miss in two attempts and omits unseen keys`.
- [ ] **Step 2:** Run, expect FAIL. Implement. Run the whole `tests/store` directory to confirm phase 1 store tests still pass.
- [ ] **Step 3:** Commit `feat(store): drill results and database v2`.

### Task 8: Backup v2

**Files:**
- Modify: `src/store/backup.ts`, `src/store/validate.ts` (add `isValidDrillResult`); Test: extend `tests/store/store.test.ts` with a new file `tests/store/backupV2.test.ts`

**Interfaces:**
- Consumes: `listDrillResults`, `saveDrillResult`, `DrillResult`.
- Produces: `exportBackup()` writes `{ version: 2, hands, sessions, drillResults }`; `importBackup(json)` accepts version 1 (no `drillResults`) and version 2; `isValidDrillResult(x: unknown): x is DrillResult`.

- [ ] **Step 1:** Tests: `export then import into an empty db restores hands, sessions and drill results`; `a version 1 backup file still imports` (Review Focus); `a drill result with a bad type, missing key or non-boolean correct makes the whole import fail and writes nothing`; `import with drillResults omitted in version 2 fails validation`.
- [ ] **Step 2:** Run, expect FAIL. Implement (validate all hands, sessions and drill results before writing anything). Run the full store tests, expect PASS.
- [ ] **Step 3:** Commit `feat(store): backup v2 with drill results`.

### Task 9: Runner

**Files:**
- Create: `src/drill/runner.ts`, `src/drill/modules/index.ts`; Test: `tests/drill/runner.test.ts`, `tests/drill/modulesProperty.test.ts`

**Interfaces:**
- Produces: `ALL_MODULES: DrillModule[]` (odds, preflop, pushfold); `buildSet(module: DrillModule, level: number, misses: Map<string, number>, rng: () => number, size?: number): Question[]` (size default 10; per slot generate 5 candidates, choose with probability proportional to `1 + 3 × (misses.get(key) ?? 0)`).

- [ ] **Step 1:** Tests: `a set has exactly 10 questions with no history` (Review Focus); `a set has 10 questions when every key in history has missRate 1` (Review Focus); `weighting favours a missed key` (fake module whose `generate` returns key A or B with equal probability; with `misses = {A: 1}` and a fixed seed, A is picked in more than 60% of 2000 slots, while with empty history it is within 45–55%); `same seed gives the same set`. Property test file: for every module, every level and 300 seeds, `generate` does not throw, every option can be graded without throwing, and at least one option is correct.
- [ ] **Step 2:** Run, expect FAIL. Implement. Run, expect PASS.
- [ ] **Step 3:** Commit `feat(drill): runner and module property tests`.

### Task 10: Drill UI and lobby entry

**Files:**
- Create: `src/ui/DrillPage.tsx`; Modify: `src/ui/Lobby.tsx` (new prop `onDrill: () => void`, button "Drills"), `src/ui/App.tsx` (screen `'drill'`), `src/ui/styles.css`; Test: `tests/ui/drill.test.tsx`

**Interfaces:**
- Produces: `DrillPage({ onBack, modules?, deps? })` where `deps?: { saveResult: (r: DrillResult) => Promise<void>; listResults: () => Promise<DrillResult[]>; rng: () => number; now: () => number }` defaulting to the real store; `modules` defaults to `ALL_MODULES` (injectable for tests). Flow: choose type and level → 10 questions → option buttons → feedback panel (`role="status"`) with correct / incorrect / borderline wording, explanation, EV table when `grade.ev` exists, certainty badge text `Exact` or `Guideline, not GTO` → "Next" → summary with score and accuracy by type. A failed save shows `role="alert"` text "This answer was not saved."

- [ ] **Step 1:** Tests (fake modules injected, fake deps): `lobby has a Drills button that opens the drill page` (through `App`); `answering shows the feedback panel with the Exact badge for an exact module`; `answering shows the Guideline, not GTO badge for an approximate module`; `a borderline grade shows the borderline wording`; `EV table appears only when the grade has ev`; `completing 10 questions shows the summary with the score`; `a failed save shows the not-saved alert and the set continues`; `results saved for every answered question`.
- [ ] **Step 2:** Run, expect FAIL. Implement (reuse `CardView` for hole cards in scenarios that have them; keep styling within existing CSS tokens). Run the whole suite: `npm test` and `npm run build`, expect all green.
- [ ] **Step 3:** Play one set of each drill type in the browser (`npm run dev`), confirm feedback, badges and EV display, and no console errors. Commit `feat(ui): drill page`.

---

## Self-review notes
- Spec coverage: three modules (T2, T3, T6), exact odds math (T1), Nash data and build script (T4–T5), UI and certainty labels (T10), DB v2 with intact hands (T7), backup v1/v2 (T8), weighted runner and property tests (T9), save-failure behaviour (T10). The `RangeSource` interface is in T3; no import UI is built.
- Names reused unchanged across tasks: `DrillModule`, `Question`, `Grade`, `DrillResult`, `pushFoldRow`, `solvePushFold`, `buildSet`, `missRates`.
- Ruling carried from the spec, stated here once: card removal between hand classes is ignored in the push/fold solver and weights.
