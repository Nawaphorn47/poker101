import type { HandLog } from '../engine/handLog';
import { listHands, listSessions, saveHand, saveSession, type SessionRecord } from './db';

const BACKUP_VERSION = 1;

export async function exportBackup(): Promise<string> {
  return JSON.stringify({ version: BACKUP_VERSION, hands: await listHands(), sessions: await listSessions() });
}

const isHand = (h: any): h is HandLog =>
  !!h && typeof h.id === 'string' && typeof h.seed === 'number' && Array.isArray(h.seats) &&
  Array.isArray(h.actions) && typeof h.humanSeat === 'number' && !!h.blinds;
const isSession = (s: any): s is SessionRecord =>
  !!s && typeof s.id === 'string' && (s.mode === 'cash' || s.mode === 'tournament') && typeof s.profitBb === 'number';

/** Validates everything before writing anything; existing records with the same id are overwritten. */
export async function importBackup(json: string): Promise<{ ok: boolean; error?: string }> {
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }
  if (!data || data.version !== BACKUP_VERSION || !Array.isArray(data.hands) || !Array.isArray(data.sessions))
    return { ok: false, error: 'Unrecognised backup format.' };
  if (!data.hands.every(isHand) || !data.sessions.every(isSession))
    return { ok: false, error: 'Backup contains malformed records.' };
  for (const h of data.hands) await saveHand(h);
  for (const s of data.sessions) await saveSession(s);
  return { ok: true };
}
