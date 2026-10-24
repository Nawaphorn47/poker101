import { chartFor } from '../../src/tools/chart';
import { pushFoldRow, PUSHFOLD_STACKS } from '../../src/drill/pushFoldData';

const cell = (c: ReturnType<typeof chartFor>, name: string) => c.cells.find((x) => x.name === name)!;

describe('chartFor', () => {
  it('has 169 cells with unique names and unique positions', () => {
    const c = chartFor(10, 'sb');
    expect(c.cells).toHaveLength(169);
    expect(new Set(c.cells.map((x) => x.name)).size).toBe(169);
    expect(new Set(c.cells.map((x) => `${x.row},${x.col}`)).size).toBe(169);
  });
  it('places pairs on the diagonal, suited above it and offsuit below', () => {
    const c = chartFor(10, 'sb');
    expect([cell(c, 'AA').row, cell(c, 'AA').col]).toEqual([0, 0]);
    expect([cell(c, '22').row, cell(c, '22').col]).toEqual([12, 12]);
    expect([cell(c, 'AKs').row, cell(c, 'AKs').col]).toEqual([0, 1]);
    expect([cell(c, 'AKo').row, cell(c, 'AKo').col]).toEqual([1, 0]);
    expect([cell(c, '32s').row, cell(c, '32s').col]).toEqual([11, 12]);
    expect([cell(c, '32o').row, cell(c, '32o').col]).toEqual([12, 11]);
    for (const x of c.cells) {
      if (x.name.length === 2) expect(x.row).toBe(x.col);
      else if (x.name.endsWith('s')) expect(x.row).toBeLessThan(x.col);
      else expect(x.row).toBeGreaterThan(x.col);
    }
  });
  it('actions match the Nash data for every stack and both roles', () => {
    for (const stack of PUSHFOLD_STACKS) {
      const row = pushFoldRow(stack);
      const sb = chartFor(stack, 'sb');
      const bb = chartFor(stack, 'bb');
      for (const x of sb.cells) expect(x.action).toBe(row.push.includes(x.name) ? 'push' : 'fold');
      for (const x of bb.cells) expect(x.action).toBe(row.call.includes(x.name) ? 'call' : 'fold');
    }
  });
  it('ev and foldEv come from the data and the role', () => {
    const row = pushFoldRow(8);
    const sb = chartFor(8, 'sb');
    const bb = chartFor(8, 'bb');
    expect(cell(sb, 'AKo').ev).toBe(row.evPush['AKo']);
    expect(cell(bb, 'AKo').ev).toBe(row.evCall['AKo']);
    expect(cell(sb, 'AKo').foldEv).toBe(-0.5);
    expect(cell(bb, 'AKo').foldEv).toBe(-1);
  });
  it('borderline is exactly when the EV is within 0.1bb of folding', () => {
    for (const role of ['sb', 'bb'] as const) {
      for (const x of chartFor(7, role).cells) expect(x.borderline).toBe(Math.abs(x.ev - x.foldEv) < 0.1);
    }
  });
  it('the percentage of combinations matches the data at the extremes and at 10bb', () => {
    expect(chartFor(2, 'sb').pct).toBeCloseTo(90.3, 1);
    expect(chartFor(10, 'sb').pct).toBeCloseTo(57.8, 1);
    expect(chartFor(15, 'sb').pct).toBeCloseTo(44.2, 1);
    expect(chartFor(2, 'bb').pct).toBeGreaterThan(95);
  });
  it('carries role and stack through', () => {
    const c = chartFor(15, 'bb');
    expect(c.role).toBe('bb');
    expect(c.stack).toBe(15);
  });
  it('throws for stacks outside 2 to 15 or not whole', () => {
    for (const s of [1, 16, 2.5, NaN, 0, -3]) expect(() => chartFor(s, 'sb')).toThrow();
  });
});
