import { useMemo, useState } from 'react';
import { createSession, type Session, type SessionDeps } from '../session/session';
import { clearResume, loadResume } from '../store/resume';
import { realDeps } from './deps';
import { Lobby } from './Lobby';
import { Table } from './Table';
import { StatsPage } from './StatsPage';
import { ReviewPage } from './ReviewPage';

type Screen = 'lobby' | 'table' | 'stats' | 'review';

export function App({ deps }: { deps?: Partial<SessionDeps> }) {
  const [screen, setScreen] = useState<Screen>('lobby');
  const [session, setSession] = useState<Session | null>(null);
  const [reviewId, setReviewId] = useState('');
  const [resume, setResume] = useState(() => loadResume());
  const merged = useMemo<SessionDeps>(() => ({ ...realDeps(), ...deps }), [deps]);

  const start = (mode: 'cash' | 'tournament', saved?: NonNullable<typeof resume>) => {
    try {
      setSession(createSession(mode, merged, saved));
      setScreen('table');
    } catch {
      // a saved game that cannot be restored is discarded; start fresh instead
      clearResume();
      setResume(null);
      setSession(createSession(mode, merged));
      setScreen('table');
    }
  };
  const exit = () => {
    clearResume();
    setResume(null);
    setSession(null);
    setScreen('lobby');
  };

  return (
    <main>
      {screen === 'lobby' && (
        <Lobby
          onStart={(m) => start(m)}
          onStats={() => setScreen('stats')}
          onResume={resume ? () => start(resume.mode, resume) : undefined}
        />
      )}
      {screen === 'table' && session && <Table session={session} onExit={exit} />}
      {screen === 'stats' && (
        <StatsPage
          onBack={() => setScreen('lobby')}
          onReview={(id) => {
            setReviewId(id);
            setScreen('review');
          }}
        />
      )}
      {screen === 'review' && <ReviewPage handId={reviewId} onBack={() => setScreen('stats')} />}
    </main>
  );
}
