export type DeckKind = 'general' | 'normal';
export type Phase = 'lobby' | 'playing';
export type PlayerZone = 'hand' | 'equipment' | 'judgment' | 'general';
export type Suit = 'spade' | 'heart' | 'club' | 'diamond';
export type CardCategory = 'basic' | 'trick' | 'equipment' | 'general';
export type Kingdom = '魏' | '蜀' | '吴' | '群' | '晋';
export type SkillTag = 'lord' | 'awakening' | 'limited' | 'locked';

export interface SkillInfo {
  name: string;
  description: string;
  tags?: SkillTag[];
}

export type ZoneRef =
  | { kind: 'deck'; deck: DeckKind; placement?: 'top' | 'bottom' }
  | { kind: 'discard' }
  | { kind: 'player'; playerId: string; zone: PlayerZone };

export interface CardView {
  id: string;
  deck: DeckKind;
  name: string;
  category: CardCategory;
  suit?: Suit;
  rank?: string;
  kingdom?: Kingdom;
  hp?: number;
  skills?: SkillInfo[];
}

export interface PlayerView {
  id: string;
  name: string;
  seat: number;
  connected: boolean;
  isHost: boolean;
  handCount: number;
  hp: number;
  /** Only populated for the requesting player. */
  hand: CardView[] | null;
  equipment: CardView[];
  judgment: CardView[];
  general: CardView[];
}

export interface LogEntry {
  id: number;
  at: number;
  text: string;
  tone: 'normal' | 'accent' | 'muted';
}

export interface ChatMessage {
  id: number;
  at: number;
  playerId: string;
  playerName: string;
  text: string;
}

export interface TableState {
  code: string;
  phase: Phase;
  revision: number;
  selfId: string;
  hostId: string;
  players: PlayerView[];
  deckCounts: Record<DeckKind, number>;
  discard: CardView[];
  logs: LogEntry[];
  chat: ChatMessage[];
  createdAt: number;
  maxPlayers: number;
}

export interface Session {
  roomCode: string;
  playerId: string;
  token: string;
  playerName: string;
}

export interface RoomSummary {
  code: string;
  phase: Phase;
  playerCount: number;
  maxPlayers: number;
}

export type TableAction =
  | { type: 'shuffle'; deck: DeckKind }
  | { type: 'move'; cardIds: string[]; to: ZoneRef }
  | { type: 'moveTop'; deck: DeckKind; to: ZoneRef }
  | { type: 'adjustHp'; playerId: string; delta: number };

export type ClientMessage =
  | { type: 'action'; action: TableAction }
  | { type: 'start' }
  | { type: 'leave' }
  | { type: 'chat'; text: string }
  | { type: 'ping' };

export type ServerMessage =
  | { type: 'state'; state: TableState }
  | { type: 'error'; message: string }
  | { type: 'left' }
  | { type: 'pong' };

export interface ApiErrorBody {
  error: string;
}

export type ApiSessionResponse = Session & { created?: boolean };

export const DECK_LABELS: Record<DeckKind, string> = {
  general: '武将牌堆',
  normal: '普通牌堆',
};

export const ZONE_LABELS: Record<PlayerZone, string> = {
  hand: '手牌区',
  equipment: '装备区',
  judgment: '判定区',
  general: '武将区',
};

export const MAX_PLAYERS = 8;
export const ROOM_CODE_LENGTH = 5;
