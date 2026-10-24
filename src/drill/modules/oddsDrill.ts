import type { DrillModule, Grade, Option, Question } from '../types';
import { evCall, nextCardEquity, outsEquity, requiredEquity } from '../oddsMath';

type OddsScenario = {
  variant: 'required' | 'outs' | 'callfold';
  /** pot including the opponent's bet */
  pot: number;
  call?: number;
  prePot?: number;
  outs?: number;
  street?: 'flop' | 'turn';
};

const TOLERANCE = 5; // percentage points, level 2
const BET_FRACTIONS = [0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.5];

const outsText = (n: number) => `${n} ${n === 1 ? "out" : "outs"}`;

const pick = <T,>(rng: () => number, xs: T[]): T => xs[Math.floor(rng() * xs.length)];
const int = (rng: () => number, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));

function shuffle<T>(rng: () => number, xs: T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** The correct percentage plus three distractors at least 10 points away, all inside [min, 100-min]. */
function percentOptions(rng: () => number, correct: number, min: number): Option[] {
  const offsets = [10, -10, 20, -20, 30, -30, 40];
  const others = offsets.map((o) => correct + o).filter((v) => v >= min && v <= 100 - min);
  const chosen = shuffle(rng, others).slice(0, 3);
  return shuffle(rng, [correct, ...chosen]).map((v) => ({ value: String(v), label: `${v}%` }));
}

function bet(rng: () => number) {
  const prePot = int(rng, 4, 40) * 5;
  const call = Math.max(1, Math.round(prePot * pick(rng, BET_FRACTIONS)));
  return { prePot, call, pot: prePot + call };
}

function generate(rng: () => number, level: number): Question<OddsScenario> {
  if (level === 1) {
    const { prePot, call, pot } = bet(rng);
    const exact = Math.round(requiredEquity(call, pot) * 100);
    return {
      type: 'odds', level, key: 'odds:L1',
      prompt: `The pot was ${prePot}. Villain bets ${call}, so the pot is now ${pot} and it costs ${call} to call. What equity do you need to break even?`,
      options: percentOptions(rng, exact, 1),
      scenario: { variant: 'required', pot, call, prePot },
    };
  }
  const street = pick(rng, ['flop', 'turn'] as const);
  // level 2 asks for the rule of 4 / rule of 2; above 12 outs the rule drifts more than the 5-point tolerance
  const outs = level === 2 ? int(rng, 1, 12) : int(rng, 1, 15);
  if (level === 2) {
    const exact = Math.round(outsEquity(outs, street) * 100);
    return {
      type: 'odds', level, key: `odds:L2:${street}:${outs}`,
      prompt: `You have ${outsText(outs)} on the ${street}. Estimate your chance to hit${street === 'flop' ? ' by the river' : ' on the next card'} (rule of ${street === 'flop' ? 4 : 2}).`,
      options: percentOptions(rng, exact, 0),
      scenario: { variant: 'outs', pot: 0, outs, street },
    };
  }
  const { prePot, call, pot } = bet(rng);
  return {
    type: 'odds', level: 3, key: `odds:L3:${street}`,
    prompt: `${outsText(outs)} on the ${street}. The pot was ${prePot}; villain bets ${call}, making it ${pot}. Call or fold? Count only the next card.`,
    options: [{ value: 'call', label: 'Call' }, { value: 'fold', label: 'Fold' }],
    scenario: { variant: 'callfold', pot, call, prePot, outs, street },
  };
}

function grade(q: Question, answer: string): Grade {
  const sc = q.scenario as OddsScenario;
  const base = { borderline: false, certainty: 'exact' as const };
  if (sc.variant === 'required') {
    const exact = requiredEquity(sc.call!, sc.pot) * 100;
    return {
      ...base,
      correct: answer === String(Math.round(exact)),
      explanation: `Required equity = call / (pot + call) = ${sc.call} / (${sc.pot} + ${sc.call}) = ${exact.toFixed(1)}%.`,
    };
  }
  if (sc.variant === 'outs') {
    const exact = outsEquity(sc.outs!, sc.street!) * 100;
    return {
      ...base,
      correct: Math.abs(Number(answer) - exact) <= TOLERANCE + 1e-9,
      explanation: `${outsText(sc.outs!)} on the ${sc.street} is exactly ${exact.toFixed(1)}%. The rule of ${sc.street === 'flop' ? 4 : 2} estimate is ${sc.outs! * (sc.street === 'flop' ? 4 : 2)}%. Answers within ${TOLERANCE} points count as correct.`,
    };
  }
  // a call that sees one card is judged on one-card odds; counting two cards would reward chasing draws
  const equity = nextCardEquity(sc.outs!, sc.street!);
  const ev = evCall(equity, sc.pot, sc.call!);
  const best = Math.max(ev, 0);
  const chosen = answer === 'call' ? ev : 0;
  return {
    ...base,
    correct: answer === 'call' ? ev > 0 : ev <= 0,
    explanation: `Counting only the next card, your equity is ${(equity * 100).toFixed(1)}% vs ${(requiredEquity(sc.call!, sc.pot) * 100).toFixed(1)}% needed. EV(call) = equity x pot - (1 - equity) x call = ${ev.toFixed(1)} chips; EV(fold) = 0. This counts only the showdown, not later betting rounds.`,
    ev: { chosen, best, unit: 'chips' },
  };
}

export const oddsDrill: DrillModule = { id: 'odds', levels: 3, generate, grade };
