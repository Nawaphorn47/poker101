import { pushFoldRow, PUSHFOLD_STACKS } from '../../src/drill/pushFoldData';
import { ALL_CLASSES } from '../../src/engine/handClass';

const names = new Set(ALL_CLASSES.map((c) => c.name));
const combos = (name: string) => (name.length === 2 ? 6 : name.endsWith('s') ? 4 : 12);
const pct = (list: string[]) => (list.reduce((a, n) => a + combos(n), 0) / 1326) * 100;

describe('push/fold data', () => {
  it('has rows for every whole stack 2..15 and only those', () => {
    expect(PUSHFOLD_STACKS).toEqual([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
    for (const s of PUSHFOLD_STACKS) expect(() => pushFoldRow(s)).not.toThrow();
  });
  it('rejects stacks outside 2..15 or not whole', () => {
    for (const s of [1, 16, 2.5, 0, -3, NaN]) expect(() => pushFoldRow(s)).toThrow();
  });
  it('AA and KK always push and AA always calls', () => {
    for (const s of PUSHFOLD_STACKS) {
      const r = pushFoldRow(s);
      expect(r.push).toContain('AA');
      expect(r.push).toContain('KK');
      expect(r.call).toContain('AA');
    }
  });
  it('the push set never grows by more than 2 classes as the stack grows', () => {
    for (const s of PUSHFOLD_STACKS.slice(0, -1)) {
      expect(pushFoldRow(s + 1).push.length).toBeLessThanOrEqual(pushFoldRow(s).push.length + 2);
    }
  });
  it('at 2bb the SB pushes at least 80% of combos and the BB calls at least 85%', () => {
    const r = pushFoldRow(2);
    expect(pct(r.push)).toBeGreaterThanOrEqual(80);
    expect(pct(r.call)).toBeGreaterThanOrEqual(85);
  });
  it('plausible ranges at 10bb and 15bb (bands from published HU tables, deliberately wide)', () => {
    expect(pct(pushFoldRow(10).push)).toBeGreaterThan(50);
    expect(pct(pushFoldRow(10).push)).toBeLessThan(68);
    expect(pct(pushFoldRow(10).call)).toBeGreaterThan(33);
    expect(pct(pushFoldRow(10).call)).toBeLessThan(50);
    expect(pct(pushFoldRow(15).push)).toBeGreaterThan(38);
    expect(pct(pushFoldRow(15).push)).toBeLessThan(55);
  });
  it('EV of pushing AA beats folding at every stack', () => {
    for (const s of PUSHFOLD_STACKS) expect(pushFoldRow(s).evPush['AA']).toBeGreaterThan(-0.5);
  });
  it('membership agrees with EV (ignoring values within rounding of the threshold)', () => {
    for (const s of PUSHFOLD_STACKS) {
      const r = pushFoldRow(s);
      for (const n of names) {
        if (Math.abs(r.evPush[n] + 0.5) > 0.002) expect(r.push.includes(n)).toBe(r.evPush[n] > -0.5);
        if (Math.abs(r.evCall[n] + 1) > 0.002) expect(r.call.includes(n)).toBe(r.evCall[n] > -1);
      }
    }
  });
  it('every EV is finite, defined for all 169 classes, and every listed class name is valid', () => {
    for (const s of PUSHFOLD_STACKS) {
      const r = pushFoldRow(s);
      expect(Object.keys(r.evPush)).toHaveLength(169);
      expect(Object.keys(r.evCall)).toHaveLength(169);
      for (const v of [...Object.values(r.evPush), ...Object.values(r.evCall)]) expect(Number.isFinite(v)).toBe(true);
      for (const n of [...r.push, ...r.call]) expect(names.has(n)).toBe(true);
    }
  });
});
