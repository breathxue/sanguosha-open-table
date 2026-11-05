import type { Session } from '../shared/types';

const SESSION_KEY = 'sgs.free-table.session.v1';
const NICKNAME_KEY = 'sgs.free-table.nickname.v1';

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<Session>;
    if (
      typeof value.roomCode === 'string' &&
      typeof value.playerId === 'string' &&
      typeof value.token === 'string' &&
      typeof value.playerName === 'string' &&
      value.roomCode.length > 0 &&
      value.token.length > 0
    ) {
      return value as Session;
    }
  } catch {
    // Ignore malformed local storage.
  }
  return null;
}

export function saveSession(session: Session): void {
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Storage may be unavailable in private browsing.
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Ignore.
  }
}

export function loadNickname(): string {
  try {
    return localStorage.getItem(NICKNAME_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveNickname(name: string): void {
  try {
    localStorage.setItem(NICKNAME_KEY, name);
  } catch {
    // Ignore.
  }
}
