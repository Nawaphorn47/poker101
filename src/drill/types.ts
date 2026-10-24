export type DrillId = 'odds' | 'preflop' | 'pushfold';

export type Option = { value: string; label: string };

export type Question<S = unknown> = {
  type: DrillId;
  level: number;
  /** scenario signature used for progress tracking and weighting */
  key: string;
  prompt: string;
  options: Option[];
  scenario: S;
};

export type Grade = {
  correct: boolean;
  /** correct, but another answer was at least as good */
  borderline: boolean;
  explanation: string;
  certainty: 'exact' | 'approximate';
  ev?: { chosen: number; best: number; unit: 'chips' | 'bb' };
};

export interface DrillModule {
  id: DrillId;
  levels: number;
  generate(rng: () => number, level: number): Question;
  grade(q: Question, answer: string): Grade;
}
