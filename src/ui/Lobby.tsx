export function Lobby(props: {
  onStart: (mode: 'cash' | 'tournament') => void;
  onStats: () => void;
  onDrill: () => void;
  onTools: () => void;
  onResume?: () => void;
}) {
  return (
    <section className="lobby">
      <h1>Poker Trainer</h1>
      <p>Practice No-Limit Hold&apos;em against bots with play money.</p>
      {props.onResume && <button onClick={props.onResume}>Continue last game</button>}
      <button onClick={() => props.onStart('cash')}>Cash game (6-max)</button>
      <button onClick={() => props.onStart('tournament')}>Tournament (9 players)</button>
      <button onClick={props.onDrill}>Drills</button>
      <button onClick={props.onTools}>Tools</button>
      <button onClick={props.onStats}>Stats and history</button>
    </section>
  );
}
