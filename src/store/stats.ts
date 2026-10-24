import { apply, createHand, type HandState } from '../engine/hand';
import type { HandLog } from '../engine/handLog';

export type Stats = { hands: number; vpip: number; pfr: number; bbPer100: number; showdownWinRate: number };

type Replay = { voluntary: boolean; raised: boolean; final: HandState };

function replay(log: HandLog): Replay {
  let state = createHand({
    seed: log.seed, seats: log.seats, buttonSeat: log.button, smallBlind: log.blinds.sb, bigBlind: log.blinds.bb,
  });
  let voluntary = false;
  let raised = false;
  for (const entry of log.actions) {
    if (entry.seat === log.humanSeat && state.street === 'preflop') {
      const t = entry.action.type;
      if (t === 'call' || t === 'raise' || t === 'bet') voluntary = true;
      if (t === 'raise' || t === 'bet') raised = true;
    }
    const r = apply(state, entry.action);
    if (!r.ok) break;
    state = r.state;
  }
  return { voluntary, raised, final: state };
}

/** All figures are computed from hand logs; nothing is stored separately. */
export function computeStats(hands: HandLog[]): Stats {
  if (hands.length === 0) return { hands: 0, vpip: 0, pfr: 0, bbPer100: 0, showdownWinRate: 0 };
  let vpip = 0, pfr = 0, net = 0, showdowns = 0, showdownWins = 0;
  for (const log of hands) {
    const r = replay(log);
    if (r.voluntary) vpip++;
    if (r.raised) pfr++;
    net += log.netBb;
    const me = r.final.seats[log.humanSeat];
    if (r.final.result?.showdown && !me.folded) {
      showdowns++;
      if ((r.final.result.winnings[log.humanSeat] ?? 0) > me.totalCommitted) showdownWins++;
    }
  }
  return {
    hands: hands.length,
    vpip: vpip / hands.length,
    pfr: pfr / hands.length,
    bbPer100: (net / hands.length) * 100,
    showdownWinRate: showdowns === 0 ? 0 : showdownWins / showdowns,
  };
}
