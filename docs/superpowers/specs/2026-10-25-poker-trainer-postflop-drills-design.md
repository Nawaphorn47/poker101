# Poker Trainer — Phase 2b: Postflop Drills (Design)

Date: 2026-10-25
Builds on: phase 2a drill framework (`DrillModule`, runner, results store) on `master`.

## Purpose and scope

Three new drill types for postflop skills, added to the existing Drills menu. Every answer is computed exactly; where an assumption is needed (the opponent's range) the question states it. There are **no questions about what the "right" bluff or c-bet is**: without a solver there is no answer key that can be verified, so none is invented.

### Drill types
1. **`madehand` — What do you have?** exact, factual.
2. **`outs` — Count your outs.** exact, factual under a stated definition.
3. **`vsrange` — Equity against a range, then call or fold.** exact given the stated range and assumptions; the range itself is a guideline.

### Position
Position appears only where it changes the answer: in `vsrange`, the **opener's position fixes his range**, and in-position / out-of-position is stated in the question. `madehand` and `outs` do not show a position because it would not affect the answer.

### Assumptions (confirm or correct)
- Heads-up postflop pot: a villain who opened preflop and a hero who called.
- `vsrange` is turn and river only. A flop question needs about 670,000 hand evaluations for the widest range (about 2 seconds), too slow to compute when the player answers. Flop can follow once grading can run asynchronously.
- No range input by the player, no 3-bet pots, no multiway pots, no sizing strategy.

### Success criteria
- All three drills play in sets of 10 with feedback; each answer is checked against an independent calculation in tests.
- Each feedback panel states the assumption it relies on and carries the "Exact" label only where the answer is exact under that assumption.
- Positions give the right in/out-of-position and the right range size for every valid pair.
- Existing drills, stored results, backups and the Tools page are unchanged.

## Architecture

```
src/drill/
  postflop.ts           positions, in/out-of-position, opening ranges by position, range expansion
  vsRange.ts            equity of one hand against a range (exact enumeration)
  modules/
    madeHandDrill.ts
    outsDrill.ts
    vsRangeDrill.ts
```
`DrillId` gains `'madehand' | 'outs' | 'vsrange'`. Layering as in 2a: `drill` depends on `engine` and `coach` only. `ui` calls `drill`.

### Positions
- Opener (villain): EP, MP, CO, BTN or SB. Hero is a caller who acts after him preflop (order EP, MP, CO, BTN, SB, BB), so hero can be CO, BTN, SB or BB depending on the opener.
- Postflop acting order: SB, BB, EP, MP, CO, BTN. Hero is in position if he comes later than the villain in that order.
- Opening range for a position = every hand class whose Chen score is at least `coach/preflopChart.openMin(position)` (the same table the preflop drill and the hint use). Sizes from that table: EP 6.6%, MP 10.7%, CO 17.8%, BTN 25.5%, SB 17.8% of the 1,326 combinations.

## Drill types in detail

### 1. `madehand`
- Level 1: hero's two cards and a board of 3, 4 or 5 cards. Choose the hand type (four options: the correct category and three others). Answer from `evaluate`. Deals are weighted so that made hands appear more often than plain high cards.
- Level 2: hero's cards, the villain's cards and a full board. Choose "you win", "villain wins" or "split". Answer from `compareScores`. Deals are weighted so that splits and kicker decisions appear.

### 2. `outs`
- Hero's two cards and a flop or turn where hero does not yet have a straight or better. Question: how many unseen cards on the **next card** would give hero a **straight or better** (a straight, flush, full house, quads or straight flush). The definition is printed in the question. Answer = number of unseen cards for which `evaluate(hole + board + card).category >= 4` **and** the hand is better than the board alone would give every player (`compareScores(evaluate(hole + board + card), evaluate(board + card)) > 0`). A card that only completes a straight or flush on the board is not an out. Level 1 keeps only questions whose outs are all straights or flushes.
- Level 1: single flush or straight draws on unpaired boards. Level 2: mixed cases (combo draws, paired boards, draws to full houses).
- Four distinct numeric options; none are negative.

### 3. `vsrange`
- Scenario: villain opened from position V, hero called from position H (in or out of position, stated), on a turn or river board. The villain bets 50%, 75% or 100% of the pot.
- Level 1: the villain bets with his **whole opening range**. Level 2: he bets only hands whose hole cards **lift the hand to a higher category than the board alone** (`evaluate(board + hole).category > evaluate(board).category`: a pair or better on an unpaired board, trips or two pair on a paired board). Categories are compared, not full scores, because a four-card turn board has fewer kickers than a five-card hand, so any extra card would count as an improvement; kicker-only gains are not a made hand.
- Equity: for every combination of the range that does not use a card of the hero or the board (and, in level 2, passes the filter), and for every possible remaining card (one on the turn, none on the river), compare the hero's hand with the villain's; wins count 1, ties 0.5. All combinations and all remaining cards are weighted equally.
- EV(call) = equity × pot after the bet − (1 − equity) × call. Call is correct when EV > 0. The question states "no further betting after your call". The feedback shows EV of calling, EV of folding (0), the range used and its share of all hands.
- A question is accepted only if at least 15 combinations remain after blockers and the filter; otherwise it is regenerated (at most 50 attempts, then level 1 behaviour is used).
- Feedback note: under this assumption position does not change the answer; in real play position changes how much of the equity is realised.
- Certainty label: **Exact** (given the stated range and assumptions). The explanation says the range is a guideline, not GTO.

## UI
`DrillPage` lists the three new drill types in the menu automatically, with titles and one-line descriptions. Questions show the board with the existing card component (the hero's cards are already shown). Menu text in the blurbs states which drills are exact and which assumptions they use.

## Data and persistence
- Stored results use the existing `drillResults` store; no schema change. The accepted type list (stored-record check, import check, progress summary, menu titles) is extended in one place each.
- Keys: `madehand:L1:<street>`, `madehand:L2`, `outs:L<level>:<street>:<outs>`, `vsrange:L<level>:<villain>:<hero>:<street>`.

## Error handling
- Grading is a pure function. If a hand-built question has no villain combinations left, grading returns a "cannot be graded" explanation and marks the answer correct (it is not the player's fault); generators prevent this in normal play.
- Result-saving failures behave as in 2a.

## Testing
- `madehand`: every option graded against `evaluate`/`compareScores`; weighting still produces every category and ties over many seeds.
- `outs`: compared with an independent card-by-card count in the test; known cases (flush draw 9 outs, open-ended straight draw 8, gutshot 4, flush draw plus open-ended straight draw 15); options distinct and non-negative.
- `vsrange`: equity checked against a hand-computable case (a one-hand range) and an independent enumeration in the test; the level 2 filter matches its definition, including on paired boards and boards that play; every valid (villain, hero) position pair gives the correct in/out-of-position; range sizes match the table above; no combination uses a card of the hero or board.
- Property test over 300 seeds for each module and level: generates, grades every option, has at least one correct answer, finite EV.
- Type lists: the three new types are accepted by stored-record validation, backup import and progress summary; older records unaffected.
- UI: the menu shows the new drills; a `vsrange` question shows the board and the range note; the Exact badge and assumption text appear.
- Regression: the full suite for phases 1, 2a and 3.
