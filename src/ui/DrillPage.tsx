import { useMemo, useRef, useState } from 'react';
import { ALL_MODULES } from '../drill/modules';
import { missRates, summarise, type Summary } from '../drill/progress';
import { buildSet } from '../drill/runner';
import type { DrillId, DrillModule, Grade, Question } from '../drill/types';
import type { Card } from '../engine/cards';
import { mulberry32 } from '../engine/deck';
import { listDrillResults, saveDrillResult, type DrillResult } from '../store/db';
import { CardView } from './CardView';

export type DrillDeps = {
  saveResult: (r: DrillResult) => Promise<void>;
  listResults: () => Promise<DrillResult[]>;
  rng: () => number;
  now: () => number;
  /** longest wait for the database before carrying on without it */
  waitMs: number;
};

/** Resolves with the promise's value, or undefined if it takes longer than `ms`. */
function within<T>(p: Promise<T>, ms: number): Promise<T | undefined> {
  return Promise.race([p, new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms))]);
}

const TITLES: Record<DrillId, string> = {
  odds: 'Pot odds / equity',
  preflop: 'Preflop by position',
  pushfold: 'Heads-up push/fold',
  madehand: 'What do you have?',
  outs: 'Count your outs',
  vsrange: 'Equity against a range',
};
const BLURBS: Record<DrillId, string> = {
  odds: 'Exact answers, counted from outs.',
  preflop: 'Guideline answers from a simple range table, not GTO.',
  pushfold: 'Short-stack shove or fold, heads-up only, with EV in big blinds.',
  madehand: 'Name your hand, or say who wins at showdown. Exact.',
  outs: 'Count the cards that give you a straight or better on the next card. Exact.',
  vsrange: 'The opener position sets his range; work out your equity and call or fold. Exact given the stated range.',
};

type Active = { module: DrillModule; level: number; questions: Question[]; index: number };

export function DrillPage({
  onBack,
  modules = ALL_MODULES,
  deps,
}: {
  onBack: () => void;
  modules?: DrillModule[];
  deps?: Partial<DrillDeps>;
}) {
  const rngRef = useRef(mulberry32(Date.now() & 0x7fffffff));
  const d: DrillDeps = useMemo(
    () => ({
      saveResult: saveDrillResult, listResults: listDrillResults, rng: rngRef.current, now: Date.now, waitMs: 2000,
      ...deps,
    }),
    [deps],
  );
  const [active, setActive] = useState<Active | null>(null);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [correctCount, setCorrectCount] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [finishing, setFinishing] = useState(false);
  const pending = useRef<Promise<unknown>[]>([]);

  async function start(module: DrillModule, level: number) {
    let results: DrillResult[] = [];
    try {
      results = (await within(d.listResults(), d.waitMs)) ?? [];
    } catch {
      /* no history available: start with plain random questions */
    }
    pending.current = [];
    setFinishing(false);
    setSummary(null);
    setGrade(null);
    setWarning(null);
    setCorrectCount(0);
    setActive({ module, level, questions: buildSet(module, level, missRates(results), d.rng), index: 0 });
  }

  function answer(value: string) {
    if (!active || grade) return;
    const q = active.questions[active.index];
    const g = active.module.grade(q, value);
    const record: DrillResult = {
      id: `${d.now()}-${active.index}-${Math.floor(d.rng() * 1e9)}`,
      type: q.type, level: q.level, key: q.key, correct: g.correct, borderline: g.borderline, timestamp: d.now(),
    };
    if (g.ev) record.evLoss = Math.max(0, g.ev.best - g.ev.chosen);
    pending.current.push(d.saveResult(record).catch(() => setWarning('This answer was not saved.')));
    if (g.correct) setCorrectCount((n) => n + 1);
    setGrade(g);
  }

  async function next() {
    if (!active || finishing) return;
    setWarning(null);
    if (active.index + 1 < active.questions.length) {
      setGrade(null);
      setActive({ ...active, index: active.index + 1 });
      return;
    }
    // last question: keep its feedback on screen (so it cannot be answered again) until the summary is ready
    setFinishing(true);
    await within(Promise.allSettled(pending.current), d.waitMs);
    let all: DrillResult[] = [];
    try {
      all = (await within(d.listResults(), d.waitMs)) ?? [];
    } catch {
      /* show the set score only */
    }
    setSummary(summarise(all));
    setGrade(null);
    setFinishing(false);
    setActive({ ...active, index: active.questions.length });
  }

  const finished = active !== null && active.index >= active.questions.length;

  if (active && finished) {
    return (
      <section className="drill">
        <h2>Set complete</h2>
        <p className="score">
          {correctCount} / {active.questions.length}
        </p>
        {summary && summary.total > 0 && (
          <ul>
            {(Object.keys(summary.byType) as DrillId[])
              .filter((t) => summary.byType[t].total > 0)
              .map((t) => (
                <li key={t}>
                  {TITLES[t]}: {Math.round(summary.byType[t].accuracy * 100)}% ({summary.byType[t].correct}/
                  {summary.byType[t].total}) over all your answers
                </li>
              ))}
          </ul>
        )}
        <button onClick={() => setActive(null)}>Play another set</button>
        <button onClick={onBack}>Back</button>
      </section>
    );
  }

  if (active) {
    const q = active.questions[active.index];
    const shown = q.scenario as { hole?: Card[]; board?: Card[] } | null;
    const hole = shown?.hole;
    const boardCards = shown?.board;
    return (
      <section className="drill">
        <button onClick={onBack}>Back</button>
        <p className="note">
          Question {active.index + 1} of {active.questions.length}
        </p>
        {boardCards && boardCards.length > 0 && (
          <div className="cards board-cards" aria-label="board">
            {boardCards.map((c, i) => (
              <CardView key={i} card={c} />
            ))}
          </div>
        )}
        {hole && (
          <div className="cards" aria-label="your cards">
            {hole.map((c, i) => (
              <CardView key={i} card={c} />
            ))}
          </div>
        )}
        <p className="prompt">{q.prompt}</p>
        {!grade && (
          <div className="options">
            {q.options.map((o) => (
              <button key={o.value} onClick={() => answer(o.value)}>
                {o.label}
              </button>
            ))}
          </div>
        )}
        {warning && (
          <div role="alert" className="warning">
            {warning}
          </div>
        )}
        {grade && (
          <>
            <div role="status" className="feedback">
              <strong>{grade.correct ? (grade.borderline ? 'Correct (borderline)' : 'Correct') : 'Incorrect'}</strong>{' '}
              <span className="tag">{grade.certainty === 'exact' ? 'Exact' : 'Guideline, not GTO'}</span>
              <p>{grade.explanation}</p>
              {grade.ev && (
                <table>
                  <tbody>
                    <tr>
                      <td>Your answer</td>
                      <td>{grade.ev.chosen.toFixed(2)} {grade.ev.unit}</td>
                    </tr>
                    <tr>
                      <td>Best answer</td>
                      <td>{grade.ev.best.toFixed(2)} {grade.ev.unit}</td>
                    </tr>
                    <tr>
                      <td>EV lost</td>
                      <td>{Math.max(0, grade.ev.best - grade.ev.chosen).toFixed(2)} {grade.ev.unit}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
            <button onClick={next} disabled={finishing}>
              {active.index + 1 === active.questions.length ? 'Finish' : 'Next question'}
            </button>
          </>
        )}
      </section>
    );
  }

  return (
    <section className="drill">
      <button onClick={onBack}>Back</button>
      <h2>Drills</h2>
      <p className="note">Sets of 10 questions. A scenario you miss is more likely to come back when it repeats.</p>
      {modules.map((m) => (
        <div key={m.id} className="drill-type">
          <h3>{TITLES[m.id]}</h3>
          <p className="note">{BLURBS[m.id]}</p>
          {Array.from({ length: m.levels }, (_, i) => i + 1).map((level) => (
            <button
              key={level}
              aria-label={`Start ${TITLES[m.id]}${m.levels > 1 ? ` level ${level}` : ''}`}
              onClick={() => start(m, level)}
            >
              {m.levels > 1 ? `Level ${level}` : 'Start'}
            </button>
          ))}
        </div>
      ))}
    </section>
  );
}
