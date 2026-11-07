export type DeckKind = 'general' | 'normal';
export type Phase = 'lobby' | 'playing';
export type PlayerZone = 'hand' | 'equipment' | 'general';
export type Suit = 'spade' | 'heart' | 'club' | 'diamond';
export type CardCategory = 'basic' | 'trick' | 'equipment' | 'general';
export type Kingdom = '魏' | '蜀' | '吴' | '群' | '晋';
export type SkillTag = 'lord' | 'awakening' | 'limited' | 'locked';
/** 队伍标记，纯展示，不影响任何操作。 */
export type Team = 'red' | 'blue';

export interface SkillInfo {
  name: string;
  description: string;
  tags?: SkillTag[];
}

/** 开放式弃牌区里的一个点：牌的中心相对弃牌区宽高的比例，0–1。 */
export interface TablePoint {
  x: number;
  y: number;
}

export type ZoneRef =
  | { kind: 'deck'; deck: DeckKind; placement?: 'top' | 'bottom' }
  /** 弃牌区是开放式桌面：带 position 表示放到指定位置，不带则由服务端自动找位置。 */
  | { kind: 'discard'; position?: TablePoint }
  /** 公共判定区：全桌共用一个，不再按玩家划分。 */
  | { kind: 'judgment' }
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
  /** 牌面图片地址（目前仅武将牌有），由服务端按 public/hero/<武将名>.jpg 生成。 */
  image?: string;
  /** 武将牌：是否已向全桌展示。未展示的武将只有持有者能看到牌面，其他人只看到牌背。 */
  revealed?: boolean;
  /** 他人武将区里未展示的武将：只给 id 和牌背，没有名字等信息。 */
  hidden?: boolean;
  /** 只有弃牌区里的牌有：在开放式弃牌区里的摆放位置。 */
  position?: TablePoint;
}

export interface PlayerView {
  id: string;
  name: string;
  seat: number;
  connected: boolean;
  isHost: boolean;
  handCount: number;
  hp: number;
  team: Team | null;
  /** Only populated for the requesting player. */
  hand: CardView[] | null;
  equipment: CardView[];
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
  /** 公共判定区里的牌，按放入顺序排列。 */
  judgment: CardView[];
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
  | { type: 'adjustHp'; playerId: string; delta: number }
  | { type: 'setHp'; playerId: string; hp: number }
  | { type: 'setTeam'; playerId: string; team: Team | null }
  /** 把自己武将区里的武将展示给全桌，展示后不可收回。 */
  | { type: 'reveal'; cardIds: string[] };

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
  general: '武将区',
};

export const TEAM_LABELS: Record<Team, string> = {
  red: '红队',
  blue: '蓝队',
};

export const MAX_PLAYERS = 8;
/** 开局每人从武将牌堆摸的张数。 */
export const GENERAL_DRAW_COUNT = 5;
/** 选将后建议保留的张数，其余放回武将牌堆底。 */
export const GENERAL_KEEP_COUNT = 3;
export const ROOM_CODE_LENGTH = 5;
