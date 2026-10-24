# Poker Trainer Phase 2b (Postflop Drills) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three new drill types (`madehand`, `outs`, `vsrange`) in the existing Drills menu, where `vsrange` ties the opener's position to his range and states in/out-of-position, and every answer is computed exactly.

**Architecture:** New modules plug into the phase 2a `DrillModule` framework. A small `postflop.ts` holds positions and opening ranges; `vsRange.ts` holds the exact equity-against-a-range calculation. Registration touches four lists (stored-record check, progress summary, menu titles, `ALL_MODULES`).

**Tech Stack:** TypeScript, React, Vite, Vitest (all already in the repo).

**Spec:** `docs/superpowers/specs/2026-10-25-poker-trainer-postflop-drills-design.md` (builds on the 2a framework on `master`).

## Global Constraints

- Layering: `drill` depends on `engine` and `coach` only; `ui` calls `drill`. No database schema change; no change to `engine`, `bots`, `session`, `tools`.
- Positions: preflop order EP, MP, CO, BTN, SB, BB; postflop order SB, BB, EP, MP, CO, BTN; hero is in position iff he is later than the villain in the postflop order. The villain is the opener (EP, MP, CO, BTN or SB); the hero is a caller acting after him preflop.
- Opening range for a position = all hand classes with Chen score >= `openMin(position)` (from `coach/preflopChart`): EP 88 combos (6.6%), MP 142 (10.7%), CO 236 (17.8%), BTN 338 (25.5%), SB 236 (17.8%) of 1,326; nested EP ⊂ MP ⊂ CO ⊂ BTN.
- `madehand`: category from `evaluate`; level 2 outcome from `compareScores`. `outs`: unseen cards `c` with `evaluate(hole + board + c).category >= 4` (straight or better) and better than the board alone (`compareScores(evaluate(hole + board + c), evaluate(board + c)) > 0`), hero currently below a straight, next card only.
- `vsrange`: turn (4 board cards) and river (5) only; villain bets 50%, 75% or 100% of the pot; level 1 = whole opening range, level 2 = only combinations with `evaluate(board + hole).category > evaluate(board).category` (categories, not full scores: a 4-card board has fewer kickers); combinations using a hero or board card are excluded; equity weights combinations and runouts equally, tie = 0.5; EV(call) = equity × pot after the bet − (1 − equity) × call; call is correct iff EV > 0; at least 15 combinations must remain (else regenerate, at most 50 attempts, then level 1 behaviour); the question says "no further betting after your call".
- Certainty label `exact` for all three; the `vsrange` explanation says the range is a guideline, not GTO, and that position does not change the answer under the assumption.
- Out of scope: flop `vsrange`, player-entered ranges, 3-bet and multiway pots, bluff/c-bet strategy.

## Review Focus

- Opener SB: only the BB can be the hero, and the BB is in position; opener EP allows MP, CO, BTN, SB, BB.
- Level 2 filter on a board that plays (royal flush on the board) and on paired boards: equal to the board alone is not "beats the board".
- Blockers: hero holding an ace removes the combinations of the range that contain that exact card; a duplicate card between hero, board and villain combination never occurs.
- Stored results of the new types are accepted by the stored-record check and by backup import; an unknown type is still rejected; older results still validate.
- A `vsrange` question never has fewer than 15 villain combinations and never an empty set to grade.

---

### Task 1: Register the new drill types

**Files:**
- Modify: `src/drill/types.ts` (`DrillId`), `src/store/validate.ts` (`DRILL_TYPES`), `src/drill/progress.ts` (`TYPES`), `src/ui/DrillPage.tsx` (`TITLES`, `BLURBS`); Test: `tests/drill/typeRegistration.test.ts`, plus adjust existing assertions that list exactly the three old types.

**Interfaces:**
- Produces: `type DrillId = 'odds' | 'preflop' | 'pushfold' | 'madehand' | 'outs' | 'vsrange'`; `DRILL_TYPES` and `progress` handle all six; titles "What do you have?", "Count your outs", "Equity against a range".

- [ ] **Step 1:** Tests: `isValidDrillResult accepts madehand, outs and vsrange records and rejects an unknown type`; `summarise returns an entry with total 0 for each of the six types`; `a backup containing a vsrange result imports and an unknown type fails the whole import`; `old odds/preflop/pushfold records still validate`. Update `tests/drill/progress.test.ts` and any test that expects exactly three types (search for `byType` and `ALL_MODULES` uses) to the new set.
- [ ] **Step 2:** Run `npx vitest run tests/drill tests/store`, expect FAIL. Implement. Run the same plus `npm run build`, expect PASS.
- [ ] **Step 3:** Commit `feat(drill): register postflop drill types`.

### Task 2: Positions and opening ranges

**Files:**
- Create: `src/drill/postflop.ts`; Test: `tests/drill/postflop.test.ts`

**Interfaces:**
- Consumes: `ALL_CLASSES`, `openMin`, `Card`.
- Produces: `type OpenerPos = 'EP' | 'MP' | 'CO' | 'BTN' | 'SB'`; `type HeroPos = OpenerPos | 'BB'`; `callersAfter(opener: OpenerPos): HeroPos[]`; `isInPosition(hero: HeroPos, villain: OpenerPos): boolean`; `expandClass(name: string): [Card, Card][]`; `openingCombos(pos: OpenerPos): [Card, Card][]`; `rangeShare(pos: OpenerPos): number` (fraction of 1,326).

- [ ] **Step 1:** Tests: `callersAfter EP is MP CO BTN SB BB; BTN is SB BB; SB is BB` (Review Focus); `isInPosition: CO vs EP true, SB vs BTN false, BB vs SB true, BTN vs CO true, BB vs BTN false, SB vs EP false`; `every valid pair has exactly one of hero in position or villain in position`; `expandClass gives 6 combos for AA, 4 for AKs, 12 for AKo, all distinct valid cards, suited combos share a suit and offsuit combos do not`; `openingCombos sizes are 88, 142, 236, 338, 236`; `rangeShare(EP) is within 0.001 of 0.066`; `ranges are nested EP ⊂ MP ⊂ CO ⊂ BTN`; `no combination holds the same card twice`.
- [ ] **Step 2:** Run, expect FAIL. Implement. Run, expect PASS.
- [ ] **Step 3:** Commit `feat(drill): positions and opening ranges`.

### Task 3: Equity against a range

**Files:**
- Create: `src/drill/vsRange.ts`; Test: `tests/drill/vsRange.test.ts`

**Interfaces:**
- Consumes: `evaluate`, `compareScores`, `Card`.
- Produces: `beatsBoard(board: Card[], hole: [Card, Card]): boolean` (strictly better than the board alone; works for 4 or 5 board cards); `equityVsRange(hero: Card[], board: Card[], range: [Card, Card][], filter?: (hole: [Card, Card]) => boolean): { equity: number; combos: number }` (board of 4 or 5 cards; `combos` = number of villain combinations used; equity is 0 and combos 0 if none remain).

- [ ] **Step 1:** Tests: `a one-hand range KsKh against hero AsAh on the river board 2c 7d 9h Jc 3s gives equity 1 and combos 1`; `hero 2h2d against the same one-hand range gives equity 0`; `a tied river gives 0.5` (board plays: board As Ks Qs Js Ts, any hero and villain); `turn equity against a two-combination range equals an independent enumeration written in the test over every river card`; `combinations containing a hero card are excluded: hero holds As, range AA gives 3 combos` (Review Focus); `combinations containing a board card are excluded`; `the filter excludes combinations (a filter that rejects everything gives combos 0)`; `beatsBoard: royal flush on the board → false for every hole; board 2c 2d 7h 9s Jc with 2h 3h → true (trips); with 3h 4h → false (plays the board); with Ah 3h → true (ace kicker improves)`; `beatsBoard works with a 4-card turn board`.
- [ ] **Step 2:** Run, expect FAIL. Implement. Run, expect PASS.
- [ ] **Step 3:** Commit `feat(drill): equity against a range`.

### Task 4: `madehand` drill

**Files:**
- Create: `src/drill/modules/madeHandDrill.ts`; Modify: `src/drill/modules/index.ts`; Test: `tests/drill/madeHandDrill.test.ts`; update `tests/drill/modulesProperty.test.ts` module list.

**Interfaces:**
- Produces: `madeHandDrill: DrillModule` (id `'madehand'`, `levels: 2`). Level 1 options are four category names (one correct), values `'0'`..`'8'` as strings of the category number; level 2 options `'hero' | 'villain' | 'split'`. Keys: `madehand:L1:<street>`, `madehand:L2`. Scenario carries `hole`, `board` (and `villain` at level 2).

- [ ] **Step 1:** Tests: `level 1 correct option equals evaluate category for 300 seeds and options are four distinct categories`; `level 1 boards have 3, 4 or 5 cards and all cards are distinct`; `across 2000 seeds at least 5 different categories occur and fewer than 60% of questions are high card`; `level 2 grading agrees with compareScores for every option`; `level 2 produces hero, villain and split outcomes over 2000 seeds`; `level 2 has hero, villain and board cards all distinct`; `grades are exact and never borderline; ev undefined`.
- [ ] **Step 2:** Run, expect FAIL. Implement (rejection-sample deals to weight made hands and ties). Register in `ALL_MODULES`. Run, expect PASS.
- [ ] **Step 3:** Commit `feat(drill): madehand drill`.

### Task 5: `outs` drill

**Files:**
- Create: `src/drill/modules/outsDrill.ts`; Modify: `src/drill/modules/index.ts`; Test: `tests/drill/outsDrill.test.ts`; update `modulesProperty.test.ts`.

**Interfaces:**
- Produces: `countOuts(hole: Card[], board: Card[]): number` (the definition in Global Constraints); `outsDrill: DrillModule` (id `'outs'`, `levels: 2`; options four distinct non-negative integers as strings). Level 1: single flush or straight draws on unpaired boards; level 2: mixed (combo draws, paired boards, draws to full houses). Keys `outs:L<level>:<street>:<outs>`.

- [ ] **Step 1:** Tests: known counts via `countOuts`: `As 5s on Ks 9s 2d is 9`; `7h 8c on 9d Tc 2s is 8`; `7h 8c on 9d Jc 2s is 4`; `8s 9s on 7s Tc 2s is 15`; `a hand that already has a straight is never generated`; `countOuts equals an independent card-by-card count in the test for 300 generated questions`; `options are distinct, non-negative and include exactly one correct answer`; `level 1 boards are unpaired`; `level 2 includes at least one paired board over 500 seeds`; `grades exact, borderline false, explanation prints the definition`.
- [ ] **Step 2:** Run, expect FAIL. Implement. Register in `ALL_MODULES`. Run, expect PASS.
- [ ] **Step 3:** Commit `feat(drill): outs drill`.

### Task 6: `vsrange` drill

**Files:**
- Create: `src/drill/modules/vsRangeDrill.ts`; Modify: `src/drill/modules/index.ts`; Test: `tests/drill/vsRangeDrill.test.ts`; update `modulesProperty.test.ts`.

**Interfaces:**
- Consumes: Tasks 2 and 3, `evCall`, `requiredEquity`-style formula from `drill/oddsMath`.
- Produces: `vsRangeDrill: DrillModule` (id `'vsrange'`, `levels: 2`, options `call`/`fold`). Scenario `{ villain: OpenerPos; hero: HeroPos; inPosition: boolean; hole: Card[]; board: Card[]; potBefore: number; bet: number; filter: 'whole' | 'beatsBoard' }`. Key `vsrange:L<level>:<villain>:<hero>:<street>`.

- [ ] **Step 1:** Tests: `for 300 seeds the scenario's inPosition equals isInPosition(hero, villain) and hero is one of callersAfter(villain)`; `the prompt states both positions, in position or out of position, the opener's range share and 'no further betting'`; `grading equals an independent computation in the test (openingCombos, evaluate and compareScores over every river card) for 20 fixed questions at both levels`; `call is correct exactly when EV > 0 and ev carries chosen and best in chips`; `level 2 uses only combinations that beat the board` (compare combos count with level 1 on a board where they differ); `a board that plays leaves no level 2 combinations so the generator falls back instead of producing an empty question` (Review Focus); `every generated question has at least 15 villain combinations`; `hero, board cards are distinct`; `explanations mention guideline and that position does not change the answer`; `certainty exact, borderline false`; `an ungradable hand-built question (no combinations) is graded correct with a 'cannot be graded' explanation`.
- [ ] **Step 2:** Run, expect FAIL. Implement (generator picks street and positions at random, deals distinct cards, retries until 15 combinations). Register in `ALL_MODULES`. Run, expect PASS.
- [ ] **Step 3:** Commit `feat(drill): equity against a range drill`.

### Task 7: UI and final checks

**Files:**
- Modify: `src/ui/DrillPage.tsx` (show board cards when the scenario has `board`); Test: extend `tests/ui/drill.test.tsx`

**Interfaces:**
- Consumes: scenarios with `board: Card[]`.

- [ ] **Step 1:** Tests: `the menu lists all six drill types with their titles`; `a question whose scenario has a board shows that many board cards in addition to the hole cards`; `the Exact badge appears for a vsrange-style fake module and the explanation text is shown`.
- [ ] **Step 2:** Run, expect FAIL. Implement. Run, expect PASS. Run the whole suite (`npm test`) and `npm run build`, expect all green.
- [ ] **Step 3:** In the browser (`npm run dev`), play one set of each new drill, confirm the board, positions, feedback and no console errors; check the numbers on one `vsrange` question by hand. Commit `feat(ui): show the board in drill questions`.

---

## Self-review notes
- Spec coverage: types registered in the four lists (T1), positions and ranges (T2), exact range equity (T3), three drills (T4-T6), board display and menu (T7), regression via full suite in T7. Positions appear only in `vsrange`, as the spec says.
- Names reused unchanged: `OpenerPos`, `HeroPos`, `openingCombos`, `isInPosition`, `equityVsRange`, `beatsBoard`, `countOuts`.
- Proportion: spec 110 lines, plan about 125 lines, test names and signatures only.
