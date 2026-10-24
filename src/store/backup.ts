import { isValidDrillResult, isValidHandLog } from './validate';
import {
  listDrillResults, listHands, listSessions, saveDrillResult, saveHand, saveSession, type SessionRecord,
} from './db';

const BACKUP_VERSION = 2;

export async function exportBackup(): Promise<string> {
  return JSON.stringify({
    version: BACKUP_VERSION,
    hands: await listHands(),
    sessions: await listSessions(),
    drillResults: await listDrillResults(),
  });
}

const isSession = (s: any): s is SessionRecord =>
  !!s && typeof s.id === 'string' && (s.mode === 'cash' || s.mode === 'tournament') && typeof s.profitBb === 'number';

/**
 * Accepts version 1 (hands and sessions only) and version 2 (plus drill results).
 * Validates everything before writing anything; records with an existing id are overwritten.
 */
export async function importBackup(json: string): Promise<{ ok: boolean; error?: string }> {
  let data: any;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: 'File is not valid JSON.' };
  }
  if (!data || (data.version !== 1 && data.version !== 2) || !Array.isArray(data.hands) || !Array.isArray(data.sessions))
    return { ok: false, error: 'Unrecognised backup format.' };
  if (data.version === 2 && !Array.isArray(data.drillResults))
    return { ok: false, error: 'Unrecognised backup format.' };
  const drillResults: unknown[] = data.version === 2 ? data.drillResults : [];
  if (!data.hands.every(isValidHandLog) || !data.sessions.every(isSession) || !drillResults.every(isValidDrillResult))
    return { ok: false, error: 'Backup contains malformed records.' };
  for (const h of data.hands) await saveHand(h);
  for (const s of data.sessions) await saveSession(s);
  for (const d of drillResults) await saveDrillResult(d as Parameters<typeof saveDrillResult>[0]);
  return { ok: true };
}
