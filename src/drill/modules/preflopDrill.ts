import type { Card } from '../../engine/cards';
import { cardToString } from '../../engine/cards';
import { shuffledDeck } from '../../engine/deck';
import type { Position } from '../../engine/hand';
import { chenScore, handClass } from '../../engine/handClass';
import { openMin } from '../../coach/preflopChart';
import { builtInRanges, type RangeSource } from '../rangeSource';
import type { DrillModule, Grade, Question } from '../types';

type PreflopScenario = { hole: Card[]; position: Position; facing: 'none' | 'raise' };

const POSITIONS: Position[] = ['EP', 'MP', 'CO', 'BTN', 'SB', 'BB'];

export function makePreflopDrill(source: RangeSource): DrillModule {
  return {
    id: 'preflop',
    levels: 1,
    generate(rng, level): Question<PreflopScenario> {
      const deck = shuffledDeck(Math.floor(rng() * 2 ** 31));
      const hole = [deck[0], deck[1]];
      const position = POSITIONS[Math.floor(rng() * POSITIONS.length)];
      const facing = rng() < 0.5 ? 'none' : 'raise';
      return {
        type: 'preflop', level, key: `preflop:${position}:${facing}:${handClass(hole)}`,
        prompt: `You hold ${hole.map(cardToString).join(' ')} on the ${position}, about 100bb deep. ${facing === 'none' ? 'Nobody has raised.' : 'A player has raised before you.'} What do you do?`,
        options: [
          { value: 'fold', label: 'Fold' },
          { value: 'call', label: facing === 'none' ? 'Call (limp)' : 'Call' },
          { value: 'raise', label: 'Raise' },
        ],
        scenario: { hole, position, facing },
      };
    },
    grade(q, answer): Grade {
      const { hole, position, facing } = q.scenario as PreflopScenario;
      const { best, acceptable } = source.advise(hole, position, facing);
      const correct = acceptable.includes(answer as never);
      const score = chenScore(hole);
      const note = acceptable.length > 1 ? ' This hand is borderline: both neighbouring answers are acceptable.' : '';
      return {
        correct,
        borderline: correct && answer !== best,
        certainty: 'approximate',
        explanation: `${handClass(hole)} from ${position} ${facing === 'none' ? 'with no raise' : 'facing a raise'}: Chen score ${score}, open threshold ${openMin(position)}. Suggested: ${best}.${note} Guideline, not GTO.`,
      };
    },
  };
}

export const preflopDrill = makePreflopDrill(builtInRanges);
