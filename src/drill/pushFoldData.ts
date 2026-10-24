import raw from './data/pushFold.json';

export type PushFoldRow = {
  push: string[];
  call: string[];
  evPush: Record<string, number>;
  evCall: Record<string, number>;
};

const stacks = (raw as unknown as { stacks: Record<string, PushFoldRow> }).stacks;

export const PUSHFOLD_STACKS: number[] = Object.keys(stacks).map(Number).sort((a, b) => a - b);

/** Heads-up Nash row for a whole-number effective stack of 2..15 big blinds. */
export function pushFoldRow(stack: number): PushFoldRow {
  const row = Number.isInteger(stack) ? stacks[String(stack)] : undefined;
  if (!row) throw new Error(`no push/fold data for a stack of ${stack}bb`);
  return row;
}
