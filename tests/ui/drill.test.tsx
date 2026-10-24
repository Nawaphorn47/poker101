import 'fake-indexeddb/auto';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { App } from '../../src/ui/App';
import { DrillPage } from '../../src/ui/DrillPage';
import { mulberry32 } from '../../src/engine/deck';
import type { DrillModule, DrillId, Grade } from '../../src/drill/types';
import type { DrillResult } from '../../src/store/db';

const fake = (id: DrillId, gradeOver: Partial<Grade> = {}): DrillModule => ({
  id,
  levels: 1,
  generate: (_rng, level) => ({
    type: id, level, key: `${id}:k`, prompt: `Question for ${id}`, scenario: null,
    options: [{ value: 'a', label: 'Answer A' }, { value: 'b', label: 'Answer B' }],
  }),
  grade: (_q, answer) => ({
    correct: answer === 'a', borderline: false, explanation: 'because reasons', certainty: 'exact', ...gradeOver,
  }),
});

function makeDeps(over: Record<string, unknown> = {}) {
  const saved: DrillResult[] = [];
  const deps = {
    saveResult: async (r: DrillResult) => void saved.push(r),
    listResults: async () => [...saved],
    rng: mulberry32(5),
    now: () => 100,
    ...over,
  };
  return { deps, saved };
}

const start = (title: string) => fireEvent.click(screen.getByRole('button', { name: `Start ${title}` }));
const answer = async (label: string) => fireEvent.click(await screen.findByRole('button', { name: label }));

describe('drill page', () => {
  it('the lobby has a Drills button that opens the drill page', async () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: 'Drills' }));
    expect(await screen.findByText('Pot odds / equity')).toBeTruthy();
    expect(screen.getByText('Heads-up push/fold')).toBeTruthy();
  });

  it('shows the Exact badge for an exact grade', async () => {
    render(<DrillPage onBack={() => {}} modules={[fake('odds')]} deps={makeDeps().deps} />);
    start('Pot odds / equity');
    await answer('Answer A');
    const panel = await screen.findByRole('status');
    expect(panel.textContent).toMatch(/Exact/);
    expect(panel.textContent).toMatch(/Correct/);
    expect(panel.textContent).toMatch(/because reasons/);
  });

  it('shows the Guideline, not GTO badge for an approximate grade', async () => {
    render(<DrillPage onBack={() => {}} modules={[fake('preflop', { certainty: 'approximate' })]} deps={makeDeps().deps} />);
    start('Preflop by position');
    await answer('Answer A');
    const panel = await screen.findByRole('status');
    expect(panel.textContent).toMatch(/Guideline, not GTO/);
    expect(panel.textContent).not.toMatch(/\bExact\b/);
  });

  it('shows borderline wording for a borderline grade', async () => {
    render(<DrillPage onBack={() => {}} modules={[fake('preflop', { borderline: true, correct: true })]} deps={makeDeps().deps} />);
    start('Preflop by position');
    await answer('Answer B');
    expect((await screen.findByRole('status')).textContent).toMatch(/borderline/i);
  });

  it('shows Incorrect for a wrong answer', async () => {
    render(<DrillPage onBack={() => {}} modules={[fake('odds')]} deps={makeDeps().deps} />);
    start('Pot odds / equity');
    await answer('Answer B');
    expect((await screen.findByRole('status')).textContent).toMatch(/Incorrect/);
  });

  it('shows the EV table only when the grade has ev', async () => {
    const withEv = fake('pushfold', { ev: { chosen: -0.2, best: 0.4, unit: 'bb' } });
    const { unmount } = render(<DrillPage onBack={() => {}} modules={[withEv]} deps={makeDeps().deps} />);
    start('Heads-up push/fold');
    await answer('Answer B');
    const panel = await screen.findByRole('status');
    expect(panel.textContent).toMatch(/EV lost/);
    expect(panel.textContent).toMatch(/0\.60/);
    unmount();
    render(<DrillPage onBack={() => {}} modules={[fake('odds')]} deps={makeDeps().deps} />);
    start('Pot odds / equity');
    await answer('Answer B');
    expect((await screen.findByRole('status')).textContent).not.toMatch(/EV lost/);
  });

  it('completing 10 questions shows the summary with the score', async () => {
    const { deps } = makeDeps();
    render(<DrillPage onBack={() => {}} modules={[fake('odds')]} deps={deps} />);
    start('Pot odds / equity');
    for (let i = 0; i < 10; i++) {
      await answer(i < 7 ? 'Answer A' : 'Answer B');
      fireEvent.click(await screen.findByRole('button', { name: i === 9 ? 'Finish' : 'Next question' }));
    }
    expect(await screen.findByText('7 / 10')).toBeTruthy();
    expect(screen.getByText(/Pot odds \/ equity/)).toBeTruthy();
  });

  it('a failed save shows the not-saved alert and the set continues', async () => {
    const { deps } = makeDeps({ saveResult: async () => { throw new Error('quota'); } });
    render(<DrillPage onBack={() => {}} modules={[fake('odds')]} deps={deps} />);
    start('Pot odds / equity');
    await answer('Answer A');
    const alert = await screen.findByRole('alert');
    expect(alert.textContent).toMatch(/This answer was not saved/);
    expect(screen.getByRole('button', { name: 'Next question' })).toBeTruthy();
  });

  it('saves a result for every answered question', async () => {
    const { deps, saved } = makeDeps();
    render(<DrillPage onBack={() => {}} modules={[fake('odds')]} deps={deps} />);
    start('Pot odds / equity');
    for (let i = 0; i < 10; i++) {
      await answer('Answer A');
      fireEvent.click(await screen.findByRole('button', { name: i === 9 ? 'Finish' : 'Next question' }));
    }
    await waitFor(() => expect(saved).toHaveLength(10));
    expect(saved[0]).toMatchObject({ type: 'odds', level: 1, key: 'odds:k', correct: true, borderline: false, timestamp: 100 });
    expect(new Set(saved.map((r) => r.id)).size).toBe(10);
  });
});
