# Poker Trainer — Phase 3: Calculator Tools (Design)

Date: 2026-10-24
Builds on: phase 1 (play vs bots) and phase 2a (drills), both merged to `master`.

## Purpose and scope

A set of calculator tools in the same browser-only site. The player enters a situation and gets an answer, with each answer labelled by how it was produced (exact, model-based, or estimated). Nothing entered is saved.

Four independent tools:
1. **Pot odds + outs** — exact.
2. **ICM** — exact under the Malmuth-Harville model.
3. **Equity** — exact when the board has 3 or more cards, simulated (with error margin) before the flop.
4. **Heads-up push/fold chart** — read from the Nash table built in phase 2a.

### Assumptions (confirm or correct)
- Hold'em no-limit, no backend, no accounts, no saved history of calculations.
- Equity takes **specific hands only** for 2–6 players; hand ranges, a range grid and range text input are out of scope.
- The push/fold chart is heads-up only; it does not account for ICM or card removal.
- Preflop equity is simulated, not enumerated: counting all 1,712,304 boards is too slow in a browser. An "exact preflop" option is out of scope.

### Success criteria
- Every tool returns correct results (checked against independent brute-force implementations in tests) and validates bad input with a message instead of calculating or crashing.
- Each result carries a label saying exact / model / estimate, and estimates show their margin of error.
- Equity never freezes the page: the simulation runs in a worker, can be stopped, and is cancelled when the input changes.
- Phase 1 and 2a behaviour is unchanged.

## Architecture

```
src/tools/
  potOdds.ts      potOddsReport(input)
  icm.ts          icmEquities(stacks, payouts)
  equity.ts       exact enumeration + simulation core (pure)
  equityWorker.ts web worker wrapper for the simulation
  chart.ts        chartFor(stack, role) -> 13x13 cells
src/ui/
  ToolsPage.tsx   tabs for the four tools
  CardPicker.tsx  52-card picker, duplicate cards disabled
  tools/          one small panel component per tool
```

Layering: `tools` depends on `engine`, `coach`/`drill` math and data (`oddsMath`, `pushFoldData`) only. `ui` calls `tools`. No changes to `engine`, `bots`, `session` or the database.

## Tools

### 1. Pot odds + outs
- Inputs: **pot before the opponent's bet**, **opponent's bet**, outs (whole number 0–20), street (flop or turn; on the river only the required equity is shown). The two separate pot/bet fields avoid the ambiguity over whether the pot already includes the bet. Pot after the bet = pot + bet; call = bet.
- Outputs: required equity = call / (pot after + call); equity on the next card (outs / 47 on the flop, / 46 on the turn); on the flop also equity by the river (1 − C(47−outs, 2) / C(47, 2)); EV of calling on each basis (equity × pot after − (1 − equity) × call); a verdict based on the next-card figure.
- If the two bases disagree (for example fold on the next card, call by the river) the result says the call is only worthwhile if no more bets follow.
- Validation: pot ≥ 0, bet > 0, outs integer 0–20.
- Reuses `drill/oddsMath`.

### 2. ICM (Malmuth-Harville)
- Inputs: 2–10 stacks (> 0) and 1–5 payouts (≥ 0, not more payouts than players).
- Method: probability that player *i* finishes first = stack_i / total; after removing the winner, the next place is chosen from the remaining stacks in proportion, and so on for each paid place. Enumerates ordered sequences of the paid places (at most 10·9·8·7·6 = 30,240). Equity of a player = sum over places of P(place) × payout.
- Outputs: prize value per player, share of the prize pool, and chip share for comparison. Labelled as a model that ignores skill and future blind pressure.

### 3. Equity
- Inputs: 2–6 players with two cards each; board of 0, 3, 4 or 5 cards (1 or 2 cards is rejected). Duplicate cards are rejected.
- Cards still to come: 0, 1 or 2 → enumerate every completion (at most 990 boards) → exact. 5 to come (no board) → simulation.
- Per player: win %, tie %, equity % (ties split equally among the tied players). Equities sum to 100%.
- Simulation: runs in a Web Worker, posts partial results about every 20,000 samples up to a cap (200,000 samples for 2 players, scaled down so that total evaluations stay near 1.2 million for more players), reports the 95% margin 1.96 × √(p(1−p)/n), can be stopped, and is cancelled when inputs change. If the worker fails to start, the page falls back to a smaller simulation on the main thread and says so.
- Reuses `engine/handEvaluator`.

### 4. Push/fold chart (heads-up)
- 13×13 grid in the standard layout (pairs on the diagonal, suited hands above it, offsuit below). Green = push (SB) or call (BB), grey = fold; a dashed border marks hands whose EV difference is under 0.1bb.
- Controls: stack slider 2–15bb (whole numbers), role toggle (SB pushes / BB calls). A summary line shows the percentage of combinations in the range; hovering or tapping a cell shows the hand, EV of each action in bb and the best action.
- Source: `drill/pushFoldData` (Nash table from phase 2a). Labelled "heads-up only, ±1% simulation error, ignores card removal".

## UI
`ToolsPage` has four tabs. A "Tools" entry is added to the lobby. `CardPicker` is a 4×13 grid; cards already used elsewhere are disabled; selecting a filled slot lets the player change or clear it. Results use the same certainty-badge style as the drills ("Exact", "Model", "Estimate ± x%").

## Error handling
- Invalid input shows a message beneath the field and no result is calculated; the calculation functions also validate and return an error value, never throw on user input.
- A running equity simulation is cancelled when any input changes, so stale results are never shown.
- Worker failure falls back as described; any remaining failure shows a plain "could not calculate" message.

## Testing
- **ICM:** compared with an independent brute-force over all finishing orders (3–4 players); equal stacks give equal values; payouts sum to the prize total; winner-take-all gives value proportional to stack; invalid inputs return errors.
- **Equity:** exact results compared with an independent enumeration in the test (turn and river boards); a full board gives 100/0 or an equal split on a tie; equities sum to 100%; duplicate cards and boards of 1–2 cards are rejected; simulation of AA vs KK is within the reported margin of 82%; a fixed seed gives a reproducible result; cancellation stops posting results.
- **Pot odds:** agrees with `drill/oddsMath`; outs 0 and river handled; disagreement between next-card and by-river bases is flagged; invalid inputs rejected.
- **Chart:** 169 cells in the correct places (AKs above the diagonal, AKo below); membership matches `pushFoldRow`; stacks outside 2–15 are rejected; summary percentage matches the data.
- **UI:** the picker will not allow a duplicate card; messages appear for incomplete input; results and badges appear for valid input; the tool tabs switch without losing the other tools' inputs.
- Regression: full phase 1 and 2a suites still pass.
