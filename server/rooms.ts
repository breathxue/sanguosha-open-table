import { randomBytes, randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import {
  DECK_LABELS,
  GENERAL_DRAW_COUNT,
  GENERAL_KEEP_COUNT,
  MAX_PLAYERS,
  ROOM_CODE_LENGTH,
  TEAM_LABELS,
  ZONE_LABELS,
  type CardView,
  type ClientMessage,
  type DeckKind,
  type LogEntry,
  type PlayerView,
  type PlayerZone,
  type RoomSummary,
  type ServerMessage,
  type Session,
  type TableAction,
  type TablePoint,
  type TableState,
  type Team,
  type ZoneRef,
} from '../src/shared/types.js';
import { createCards, shuffleInPlace, toCardView, type Card } from './cards.js';

const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_LOGS = 160;
const MAX_CHAT = 100;
const ROOM_IDLE_TTL_MS = 2 * 60 * 60 * 1000;

export interface RoomPlayer {
  id: string;
  name: string;
  seat: number;
  hp: number;
  team: Team | null;
  token: string;
  joinedAt: number;
}

export interface PlayerZones {
  hand: string[];
  equipment: string[];
  general: string[];
}

export interface Room {
  code: string;
  hostId: string;
  phase: 'lobby' | 'playing';
  revision: number;
  createdAt: number;
  updatedAt: number;
  players: RoomPlayer[];
  cards: Map<string, Card>;
  decks: Record<DeckKind, string[]>;
  discard: string[];
  /** 开放式弃牌区里每张牌的位置（牌中心相对弃牌区的比例）。 */
  discardPositions: Map<string, TablePoint>;
  /** 公共判定区（全桌共用）。 */
  judgment: string[];
  playerZones: Map<string, PlayerZones>;
  logs: LogEntry[];
  chat: TableState['chat'];
  nextLogId: number;
  nextChatId: number;
  sockets: Map<string, Set<WebSocket>>;
  cleanupTimer: NodeJS.Timeout | null;
}

export interface RoomSession {
  room: Room;
  player: RoomPlayer;
  session: Session;
  created?: boolean;
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

type CardLocation =
  | { kind: 'deck'; deck: DeckKind; placement?: 'top' | 'bottom' }
  | { kind: 'discard'; position?: TablePoint }
  | { kind: 'judgment' }
  | { kind: 'player'; playerId: string; zone: PlayerZone };

function makeRoomCode(existing: Map<string, Room>): string {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    let code = '';
    const bytes = randomBytes(ROOM_CODE_LENGTH);
    for (let i = 0; i < ROOM_CODE_LENGTH; i += 1) {
      code += ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length];
    }
    if (!existing.has(code)) return code;
  }
  return randomUUID().replaceAll('-', '').slice(0, ROOM_CODE_LENGTH).toUpperCase();
}

export function cleanPlayerName(value: unknown): string {
  const raw = typeof value === 'string' ? value : '';
  const normalized = raw.replace(/\s+/g, ' ').trim();
  const chars = [...normalized];
  if (chars.length === 0) return '无名侠客';
  return chars.slice(0, 12).join('');
}

export function normalizeRoomCode(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

function assertValidRoomCode(code: string): void {
  if (!new RegExp(`^[A-Z0-9]{${ROOM_CODE_LENGTH}}$`).test(code)) {
    throw new PublicError(`房间号需要是 ${ROOM_CODE_LENGTH} 位字母或数字`, 400);
  }
}

function emptyZones(): PlayerZones {
  return { hand: [], equipment: [], general: [] };
}

function findCardLocation(room: Room, cardId: string): CardLocation | null {
  if (room.decks.normal.includes(cardId)) return { kind: 'deck', deck: 'normal' };
  if (room.decks.general.includes(cardId)) return { kind: 'deck', deck: 'general' };
  if (room.discard.includes(cardId)) return { kind: 'discard' };
  if (room.judgment.includes(cardId)) return { kind: 'judgment' };

  for (const [playerId, zones] of room.playerZones) {
    for (const zone of ['hand', 'equipment', 'general'] as PlayerZone[]) {
      if (zones[zone].includes(cardId)) {
        return { kind: 'player', playerId, zone };
      }
    }
  }
  return null;
}

function removeCardFrom(room: Room, cardId: string, location: CardLocation): void {
  if (location.kind === 'deck') {
    const list = room.decks[location.deck];
    const index = list.indexOf(cardId);
    if (index >= 0) list.splice(index, 1);
    return;
  }
  if (location.kind === 'discard') {
    const index = room.discard.indexOf(cardId);
    if (index >= 0) room.discard.splice(index, 1);
    room.discardPositions.delete(cardId);
    return;
  }
  if (location.kind === 'judgment') {
    const index = room.judgment.indexOf(cardId);
    if (index >= 0) room.judgment.splice(index, 1);
    return;
  }
  const zones = room.playerZones.get(location.playerId);
  if (!zones) return;
  const list = zones[location.zone];
  const index = list.indexOf(cardId);
  if (index >= 0) list.splice(index, 1);
}

function putCardsAt(room: Room, cardIds: string[], to: ZoneRef): void {
  let target: string[];
  if (to.kind === 'deck') {
    target = room.decks[to.deck];
    if ((to.placement ?? 'top') === 'bottom') {
      target.push(...cardIds);
    } else {
      for (let i = cardIds.length - 1; i >= 0; i -= 1) target.unshift(cardIds[i]);
    }
    return;
  }
  if (to.kind === 'discard') {
    // 开放式弃牌区：最新放进来的在数组头部（画在最上层）。
    // 指定了位置就按位置放，多张牌依次错开一点；没指定就自动找个位置。
    cardIds.forEach((cardId, index) => {
      const base = to.position ?? autoDiscardPosition(room.discard.length + index);
      room.discardPositions.set(cardId, clampPoint({ x: base.x + index * 0.035, y: base.y + index * 0.04 }));
    });
    for (let i = cardIds.length - 1; i >= 0; i -= 1) room.discard.unshift(cardIds[i]);
    return;
  }
  if (to.kind === 'judgment') {
    // 判定区按放入顺序排成一行，新牌放在末尾。
    room.judgment.push(...cardIds);
    return;
  }
  const zones = room.playerZones.get(to.playerId);
  if (!zones) return;
  target = zones[to.zone];
  target.push(...cardIds);
}

/** 弃牌区位置允许的范围：留出半张牌的边距，避免牌贴边被裁。 */
const DISCARD_MARGIN_X = 0.08;
const DISCARD_MARGIN_Y = 0.18;

function clampPoint(point: TablePoint): TablePoint {
  return {
    x: Math.min(1 - DISCARD_MARGIN_X, Math.max(DISCARD_MARGIN_X, point.x)),
    y: Math.min(1 - DISCARD_MARGIN_Y, Math.max(DISCARD_MARGIN_Y, point.y)),
  };
}

/** 没指定位置时（弹窗移动、离桌清牌等）按序号在弃牌区里错落铺开。 */
function autoDiscardPosition(index: number): TablePoint {
  const columns = 6;
  const col = index % columns;
  const row = Math.floor(index / columns) % 3;
  return clampPoint({
    x: 0.14 + col * 0.145 + (row % 2) * 0.05,
    y: 0.3 + row * 0.22,
  });
}

function isValidPoint(value: unknown): value is TablePoint {
  if (!value || typeof value !== 'object') return false;
  const point = value as Record<string, unknown>;
  return (
    typeof point.x === 'number' &&
    typeof point.y === 'number' &&
    Number.isFinite(point.x) &&
    Number.isFinite(point.y) &&
    point.x >= 0 &&
    point.x <= 1 &&
    point.y >= 0 &&
    point.y <= 1
  );
}

function sameZone(a: CardLocation, b: ZoneRef): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'deck' && b.kind === 'deck') {
    return a.deck === b.deck && (a.placement ?? 'top') === (b.placement ?? 'top');
  }
  if (a.kind === 'discard' && b.kind === 'discard') return true;
  if (a.kind === 'judgment' && b.kind === 'judgment') return true;
  if (a.kind === 'player' && b.kind === 'player') {
    return a.playerId === b.playerId && a.zone === b.zone;
  }
  return false;
}

function isValidZoneRef(room: Room, value: unknown): value is ZoneRef {
  if (!value || typeof value !== 'object') return false;
  const zone = value as Record<string, unknown>;
  if (zone.kind === 'deck') {
    return (
      (zone.deck === 'general' || zone.deck === 'normal') &&
      (zone.placement === undefined || zone.placement === 'top' || zone.placement === 'bottom')
    );
  }
  if (zone.kind === 'discard') return zone.position === undefined || isValidPoint(zone.position);
  if (zone.kind === 'judgment') return true;
  if (zone.kind === 'player') {
    return (
      typeof zone.playerId === 'string' &&
      room.players.some((player) => player.id === zone.playerId) &&
      (zone.zone === 'hand' || zone.zone === 'equipment' || zone.zone === 'general')
    );
  }
  return false;
}

function describeLocation(room: Room, viewerId: string, location: CardLocation): string {
  if (location.kind === 'deck') return DECK_LABELS[location.deck];
  if (location.kind === 'discard') return '弃牌区';
  if (location.kind === 'judgment') return '判定区';
  const player = room.players.find((item) => item.id === location.playerId);
  if (!player) return ZONE_LABELS[location.zone];
  return `${player.id === viewerId ? '自己的' : `${player.name}的`}${ZONE_LABELS[location.zone]}`;
}

function describeDestination(room: Room, viewerId: string, to: ZoneRef): string {
  if (to.kind === 'deck') return DECK_LABELS[to.deck];
  if (to.kind === 'discard') return '弃牌区';
  if (to.kind === 'judgment') return '判定区';
  const player = room.players.find((item) => item.id === to.playerId);
  if (!player) return ZONE_LABELS[to.zone];
  return `${player.id === viewerId ? '自己的' : `${player.name}的`}${ZONE_LABELS[to.zone]}`;
}

/** 牌堆、手牌，以及武将区里尚未展示的武将，都是只有持有者（或无人）可见的位置。 */
function isHiddenLocation(room: Room, location: CardLocation, cardId: string): boolean {
  if (location.kind === 'deck') return true;
  if (location.kind !== 'player') return false;
  if (location.zone === 'hand') return true;
  if (location.zone === 'general') {
    const card = room.cards.get(cardId);
    return Boolean(card && card.category === 'general' && !card.revealed);
  }
  return false;
}

function isHiddenDestination(room: Room, to: ZoneRef, cardIds: string[]): boolean {
  if (to.kind === 'deck') return true;
  if (to.kind !== 'player') return false;
  if (to.zone === 'hand') return true;
  if (to.zone === 'general') {
    return cardIds.some((id) => {
      const card = room.cards.get(id);
      return card && card.category === 'general' && !card.revealed;
    });
  }
  return false;
}

/**
 * 武将牌和普通牌分区放置：武将牌放到手牌区时落到武将区，普通牌放到武将区时落到手牌区。
 * 只对玩家区域生效；牌堆、弃牌区、判定区、装备区照原样。
 */
function resolveDestination(room: Room, cardId: string, to: ZoneRef): ZoneRef {
  if (to.kind !== 'player') return to;
  const card = room.cards.get(cardId);
  if (!card) return to;
  if (card.category === 'general' && to.zone === 'hand') return { ...to, zone: 'general' };
  if (card.category !== 'general' && to.zone === 'general') return { ...to, zone: 'hand' };
  return to;
}

/** 牌离开武将区后的可见性：回牌堆则重新变成未知；进公开区域则视为已展示。 */
function applyVisibility(room: Room, cardIds: string[], to: ZoneRef): void {
  for (const id of cardIds) {
    const card = room.cards.get(id);
    if (!card || card.category !== 'general') continue;
    if (to.kind === 'deck') card.revealed = false;
    else if (
      to.kind === 'discard' ||
      to.kind === 'judgment' ||
      (to.kind === 'player' && to.zone !== 'general' && to.zone !== 'hand')
    ) {
      card.revealed = true;
    }
  }
}

export class RoomStore {
  readonly rooms = new Map<string, Room>();

  createRoom(rawName: unknown, rawCode?: unknown): RoomSession {
    const name = cleanPlayerName(rawName);
    const customCode = typeof rawCode === 'string' ? normalizeRoomCode(rawCode) : '';
    if (customCode) {
      assertValidRoomCode(customCode);
      if (this.rooms.has(customCode)) {
        throw new PublicError('这个房间号已经有人用了，换一个试试', 409);
      }
    }
    const code = customCode || makeRoomCode(this.rooms);
    const { cards, decks } = createCards();
    const player = this.newPlayer(name, 0);
    const now = Date.now();
    const room: Room = {
      code,
      hostId: player.id,
      phase: 'lobby',
      revision: 1,
      createdAt: now,
      updatedAt: now,
      players: [player],
      cards,
      decks,
      discard: [],
      discardPositions: new Map(),
      judgment: [],
      playerZones: new Map([[player.id, emptyZones()]]),
      logs: [],
      chat: [],
      nextLogId: 1,
      nextChatId: 1,
      sockets: new Map(),
      cleanupTimer: null,
    };
    this.rooms.set(code, room);
    this.addLog(room, `${name} 创建了牌桌`, 'accent');
    return { room, player, session: this.sessionFor(room, player), created: true };
  }

  joinRoom(rawCode: unknown, rawName: unknown): RoomSession {
    const code = normalizeRoomCode(rawCode);
    assertValidRoomCode(code);
    const room = this.rooms.get(code);
    if (!room) {
      // A friend can send any 5-character code. If nobody has opened that
      // table yet, joining it creates the room and makes this player host.
      return this.createRoom(rawName, code);
    }
    if (room.players.length >= MAX_PLAYERS) {
      throw new PublicError(`牌桌已满（最多 ${MAX_PLAYERS} 人）`, 409);
    }
    const name = cleanPlayerName(rawName);
    if (room.players.some((player) => player.name.toLowerCase() === name.toLowerCase())) {
      throw new PublicError('房间里已有同名玩家，请换一个昵称', 409);
    }

    const usedSeats = new Set(room.players.map((player) => player.seat));
    let seat = 0;
    while (usedSeats.has(seat)) seat += 1;
    const player = this.newPlayer(name, seat);
    room.players.push(player);
    room.playerZones.set(player.id, emptyZones());
    if (room.phase === 'playing') {
      const dealt = this.dealGenerals(room, player.id);
      this.addLog(
        room,
        dealt > 0 ? `${name} 加入了牌桌，摸了 ${dealt} 张武将牌` : `${name} 加入了牌桌`,
        'muted',
      );
    } else {
      this.addLog(room, `${name} 加入了房间`, 'muted');
    }
    this.touch(room);
    return { room, player, session: this.sessionFor(room, player), created: false };
  }

  authenticate(rawCode: unknown, rawToken: unknown): RoomSession | null {
    const code = normalizeRoomCode(rawCode);
    const token = typeof rawToken === 'string' ? rawToken : '';
    const room = this.rooms.get(code);
    if (!room || !token) return null;
    const player = room.players.find((item) => item.token === token);
    if (!player) return null;
    return { room, player, session: this.sessionFor(room, player) };
  }

  startGame(room: Room, playerId: string): ActionResult {
    const player = room.players.find((item) => item.id === playerId);
    if (!player) return { ok: false, error: '你已不在牌桌中' };
    if (room.phase === 'playing') return { ok: false, error: '牌局已经开始了' };
    room.phase = 'playing';
    this.addLog(room, `${player.name} 开始了牌局 · 规则由你们决定`, 'accent');
    for (const item of this.sortedPlayers(room)) this.dealGenerals(room, item.id);
    this.addLog(
      room,
      `每人从武将牌堆摸了 ${GENERAL_DRAW_COUNT} 张武将牌，各自保留 ${GENERAL_KEEP_COUNT} 张，其余放回武将牌堆底`,
      'accent',
    );
    this.touch(room);
    return { ok: true };
  }

  /** 从武将牌堆顶给玩家发武将到武将区（未展示）。返回实际发出的张数。 */
  private dealGenerals(room: Room, playerId: string): number {
    const zones = room.playerZones.get(playerId);
    if (!zones) return 0;
    let dealt = 0;
    while (dealt < GENERAL_DRAW_COUNT && room.decks.general.length > 0) {
      const cardId = room.decks.general.shift()!;
      const card = room.cards.get(cardId);
      if (card) card.revealed = false;
      zones.general.push(cardId);
      dealt += 1;
    }
    return dealt;
  }

  performAction(room: Room, playerId: string, action: TableAction): ActionResult {
    const player = room.players.find((item) => item.id === playerId);
    if (!player) return { ok: false, error: '你已不在牌桌中' };
    if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
      return { ok: false, error: '无法识别的操作' };
    }

    // 队伍标记在大厅里也可以设置，所以放在「牌局是否开始」的检查之前。
    if (action.type === 'setTeam') {
      if (typeof action.playerId !== 'string') {
        return { ok: false, error: '无法识别要标记的玩家' };
      }
      const target = room.players.find((item) => item.id === action.playerId);
      if (!target) return { ok: false, error: '目标玩家已经不在牌桌上了' };
      const team = action.team;
      if (team !== null && team !== 'red' && team !== 'blue') {
        return { ok: false, error: '无法识别的队伍' };
      }
      if (team === target.team) return { ok: true };
      target.team = team;
      const owner = target.id === player.id ? '自己' : target.name;
      this.addLog(
        room,
        team ? `${player.name} 将${owner}标为${TEAM_LABELS[team]}` : `${player.name} 取消了${owner}的队伍标记`,
        'normal',
      );
      this.touch(room);
      return { ok: true };
    }

    if (room.phase !== 'playing') return { ok: false, error: '牌局还没有开始' };

    if (action.type === 'reveal') {
      if (!Array.isArray(action.cardIds) || action.cardIds.length === 0) {
        return { ok: false, error: '请先选择要展示的武将' };
      }
      if (!action.cardIds.every((id) => typeof id === 'string')) {
        return { ok: false, error: '牌的信息不正确' };
      }
      const zones = room.playerZones.get(player.id);
      const cardIds = [...new Set(action.cardIds)];
      const cards: Card[] = [];
      for (const id of cardIds) {
        if (!zones || !zones.general.includes(id)) {
          return { ok: false, error: '只能展示自己武将区里的武将' };
        }
        const card = room.cards.get(id);
        if (!card || card.category !== 'general') {
          return { ok: false, error: '只有武将牌可以展示' };
        }
        if (!card.revealed) cards.push(card);
      }
      if (cards.length === 0) return { ok: true };
      for (const card of cards) card.revealed = true;
      this.addLog(
        room,
        `${player.name} 展示了武将 ${cards.map((card) => `【${card.name}】`).join('、')}`,
        'accent',
      );
      this.touch(room);
      return { ok: true };
    }

    if (action.type === 'adjustHp') {
      if (typeof action.playerId !== 'string') {
        return { ok: false, error: '无法识别要调整体力的玩家' };
      }
      const target = room.players.find((item) => item.id === action.playerId);
      if (!target) return { ok: false, error: '目标玩家已经不在牌桌上了' };
      if (target.id !== player.id) return { ok: false, error: '只能调整自己的体力' };
      if (
        typeof action.delta !== 'number' ||
        !Number.isFinite(action.delta) ||
        !Number.isInteger(action.delta) ||
        Math.abs(action.delta) > 10
      ) {
        return { ok: false, error: '体力调整值不正确' };
      }
      const next = Math.max(0, Math.min(99, target.hp + action.delta));
      if (next === target.hp) return { ok: true };
      target.hp = next;
      const owner = target.id === player.id ? '自己' : target.name;
      this.addLog(room, `${player.name} 将${owner}的体力调整为 ${next}`, 'normal');
      this.touch(room);
      return { ok: true };
    }

    if (action.type === 'setHp') {
      if (typeof action.playerId !== 'string') {
        return { ok: false, error: '无法识别要设置体力的玩家' };
      }
      const target = room.players.find((item) => item.id === action.playerId);
      if (!target) return { ok: false, error: '目标玩家已经不在牌桌上了' };
      if (target.id !== player.id) return { ok: false, error: '只能调整自己的体力' };
      if (typeof action.hp !== 'number' || !Number.isInteger(action.hp) || action.hp < 0 || action.hp > 99) {
        return { ok: false, error: '体力值不正确' };
      }
      if (action.hp === target.hp) return { ok: true };
      target.hp = action.hp;
      const owner = target.id === player.id ? '自己' : target.name;
      this.addLog(room, `${player.name} 将${owner}的体力设为 ${action.hp}`, 'normal');
      this.touch(room);
      return { ok: true };
    }

    if (action.type === 'shuffle') {
      if (action.deck !== 'general' && action.deck !== 'normal') {
        return { ok: false, error: '无法识别的牌堆' };
      }
      shuffleInPlace(room.decks[action.deck]);
      this.addLog(room, `${player.name} 洗乱了${DECK_LABELS[action.deck]}`, 'normal');
      this.touch(room);
      return { ok: true };
    }

    if (action.type === 'moveTop') {
      if (action.deck !== 'general' && action.deck !== 'normal') {
        return { ok: false, error: '无法识别的牌堆' };
      }
      if (!isValidZoneRef(room, action.to)) return { ok: false, error: '目标区域不存在' };
      const deck = room.decks[action.deck];
      const cardId = deck[0];
      if (!cardId) return { ok: false, error: `${DECK_LABELS[action.deck]}已经空了` };
      deck.shift();
      const to = resolveDestination(room, cardId, action.to);
      putCardsAt(room, [cardId], to);
      applyVisibility(room, [cardId], to);
      const card = room.cards.get(cardId);
      const toHand = to.kind === 'player' && (to.zone === 'hand' || to.zone === 'general');
      const toDeck = to.kind === 'deck';
      const toOwnHand = toHand && to.kind === 'player' && to.playerId === player.id;
      const unit = action.deck === 'general' ? '武将牌' : '牌';
      const dest = describeDestination(room, player.id, to);
      if (toOwnHand) {
        this.addLog(room, `${player.name} 从${DECK_LABELS[action.deck]}摸了 1 张${unit}`, 'normal');
      } else if (toHand) {
        this.addLog(room, `${player.name} 将${DECK_LABELS[action.deck]}顶的 1 张${unit}放入${dest}`, 'normal');
      } else if (toDeck) {
        this.addLog(
          room,
          `${player.name} 将${DECK_LABELS[action.deck]}顶的 1 张牌移到${dest}`,
          'normal',
        );
      } else if (card) {
        this.addLog(
          room,
          `${player.name} 从${DECK_LABELS[action.deck]}顶翻开【${card.name}】到${dest}`,
          'accent',
        );
      }
      this.touch(room);
      return { ok: true };
    }

    if (action.type === 'move') {
      if (!Array.isArray(action.cardIds) || action.cardIds.length === 0) {
        return { ok: false, error: '请先选择牌' };
      }
      if (action.cardIds.length > 100) return { ok: false, error: '一次最多移动 100 张牌' };
      if (!action.cardIds.every((id) => typeof id === 'string')) {
        return { ok: false, error: '牌的信息不正确' };
      }
      const cardIds = [...new Set(action.cardIds)];
      if (!isValidZoneRef(room, action.to)) return { ok: false, error: '目标区域不存在' };

      const located = cardIds.map((cardId) => ({
        cardId,
        location: findCardLocation(room, cardId),
      }));
      if (located.some((item) => !item.location)) {
        return { ok: false, error: '有牌已经不在牌桌上了，请刷新后重试' };
      }

      for (const item of located) {
        const location = item.location!;
        if (isHiddenLocation(room, location, item.cardId)) {
          const ownPrivate =
            location.kind === 'player' &&
            location.playerId === player.id &&
            (location.zone === 'hand' || location.zone === 'general');
          if (!ownPrivate) return { ok: false, error: '不能移动尚未公开的牌' };
        }
      }

      // 武将牌 / 普通牌分区：按每张牌各自落到的区域分组。
      const targets = new Map<string, { to: ZoneRef; ids: string[] }>();
      for (const item of located) {
        const to = resolveDestination(room, item.cardId, action.to);
        const key = JSON.stringify(to);
        const group = targets.get(key) ?? { to, ids: [] };
        group.ids.push(item.cardId);
        targets.set(key, group);
      }
      const resolvedFor = (cardId: string): ZoneRef => resolveDestination(room, cardId, action.to);

      // 弃牌区内挪位置：牌已经在弃牌区、目标也是弃牌区且带位置，只改位置并提到最上层，不写记录。
      if (
        action.to.kind === 'discard' &&
        action.to.position &&
        located.every((item) => item.location!.kind === 'discard')
      ) {
        const position = action.to.position;
        for (const item of located) removeCardFrom(room, item.cardId, item.location!);
        putCardsAt(room, cardIds, { kind: 'discard', position });
        this.touch(room);
        return { ok: true };
      }

      if (located.every((item) => sameZone(item.location!, resolvedFor(item.cardId)))) {
        const redirected = located.some((item) => !sameZone(resolvedFor(item.cardId), action.to));
        return {
          ok: false,
          error: redirected ? '武将牌放武将区、普通牌放手牌区，这些牌已经在各自的区域了' : '这些牌已经在目标区域了',
        };
      }

      const fromDescriptions = [
        ...new Set(located.map((item) => describeLocation(room, player.id, item.location!))),
      ];
      const firstLocation = located[0].location!;
      const onlyOneZone = located.every((item) => sameZone(item.location!, firstLocation));
      const hiddenSource = located.some((item) => isHiddenLocation(room, item.location!, item.cardId));
      const hiddenDestination = [...targets.values()].some((group) =>
        isHiddenDestination(room, group.to, group.ids),
      );
      const cardViews = cardIds
        .map((id) => room.cards.get(id))
        .filter((card): card is Card => Boolean(card));
      const allGenerals = cardViews.length > 0 && cardViews.every((card) => card.category === 'general');

      for (const item of located) {
        removeCardFrom(room, item.cardId, item.location!);
      }
      for (const group of targets.values()) {
        putCardsAt(room, group.ids, group.to);
        applyVisibility(room, group.ids, group.to);
      }

      let phrase = `${cardIds.length} 张${allGenerals ? '武将牌' : '牌'}`;
      if (!hiddenSource && !hiddenDestination && cardViews.length > 0) {
        if (cardViews.length === 1) {
          phrase = `【${cardViews[0].name}】`;
        } else if (cardViews.length <= 3 && new Set(cardViews.map((card) => card.name)).size === 1) {
          phrase = `【${cardViews[0].name}】×${cardViews.length}`;
        } else if (cardViews.length <= 3) {
          phrase = cardViews.map((card) => `【${card.name}】`).join('、');
        }
      }
      const fromText = onlyOneZone ? fromDescriptions[0] : `${fromDescriptions.join('、')}等区域`;
      const destinations = [...new Set([...targets.values()].map((group) => describeDestination(room, player.id, group.to)))];
      const dest = destinations.join('和');
      this.addLog(room, `${player.name} 将 ${phrase} 从${fromText}移到${dest}`, 'normal');
      this.touch(room);
      return { ok: true };
    }

    return { ok: false, error: '无法识别的操作' };
  }

  addChat(room: Room, playerId: string, rawText: string): ActionResult {
    const player = room.players.find((item) => item.id === playerId);
    if (!player) return { ok: false, error: '你已不在牌桌中' };
    const text = typeof rawText === 'string' ? rawText.replace(/\s+/g, ' ').trim() : '';
    const chars = [...text];
    if (chars.length === 0) return { ok: false, error: '消息不能为空' };
    const message = chars.slice(0, 200).join('');
    room.chat.push({
      id: room.nextChatId++,
      at: Date.now(),
      playerId,
      playerName: player.name,
      text: message,
    });
    if (room.chat.length > MAX_CHAT) room.chat.splice(0, room.chat.length - MAX_CHAT);
    this.touch(room);
    return { ok: true };
  }

  leaveRoom(room: Room, playerId: string): { deleted: boolean } {
    const player = room.players.find((item) => item.id === playerId);
    if (!player) return { deleted: this.rooms.get(room.code) !== room };

    if (room.phase === 'playing') {
      const zones = room.playerZones.get(playerId);
      if (zones) {
        const orphaned = [
          ...zones.hand,
          ...zones.equipment,
          ...zones.general,
        ];
        if (orphaned.length > 0) {
          for (const cardId of orphaned) {
            const location = findCardLocation(room, cardId);
            if (location) removeCardFrom(room, cardId, location);
          }
          putCardsAt(room, orphaned, { kind: 'discard' });
          applyVisibility(room, orphaned, { kind: 'discard' });
        }
      }
      this.addLog(room, `${player.name} 离开了牌桌，其区域内的牌进入弃牌区`, 'muted');
    } else {
      this.addLog(room, `${player.name} 离开了房间`, 'muted');
    }

    room.playerZones.delete(playerId);
    room.players = room.players.filter((item) => item.id !== playerId);
    const sockets = room.sockets.get(playerId);
    room.sockets.delete(playerId);
    if (sockets) {
      for (const socket of sockets) {
        try {
          sendTo(socket, { type: 'left' });
          socket.close(4001, 'left room');
        } catch {
          // Socket already gone.
        }
      }
    }

    if (room.players.length === 0) {
      this.deleteRoom(room);
      return { deleted: true };
    }

    if (room.hostId === playerId) {
      room.hostId = this.sortedPlayers(room)[0].id;
    }
    this.touch(room);
    return { deleted: false };
  }

  attachSocket(room: Room, playerId: string, socket: WebSocket): void {
    if (room.cleanupTimer) {
      clearTimeout(room.cleanupTimer);
      room.cleanupTimer = null;
    }
    let sockets = room.sockets.get(playerId);
    if (!sockets) {
      sockets = new Set();
      room.sockets.set(playerId, sockets);
    }
    sockets.add(socket);
    this.touch(room);
  }

  detachSocket(room: Room, playerId: string, socket: WebSocket): void {
    const sockets = room.sockets.get(playerId);
    if (!sockets) return;
    sockets.delete(socket);
    if (sockets.size === 0) room.sockets.delete(playerId);
    this.touch(room);
    if (room.players.length > 0 && room.sockets.size === 0) {
      room.cleanupTimer = setTimeout(() => {
        if (room.sockets.size === 0) this.deleteRoom(room);
      }, ROOM_IDLE_TTL_MS);
      room.cleanupTimer.unref?.();
    }
  }

  broadcast(room: Room): void {
    for (const player of room.players) {
      const sockets = room.sockets.get(player.id);
      if (!sockets || sockets.size === 0) continue;
      const state = this.viewFor(room, player.id);
      const message: ServerMessage = { type: 'state', state };
      const serialized = JSON.stringify(message);
      for (const socket of sockets) {
        if (socket.readyState === 1) socket.send(serialized);
      }
    }
  }

  sendState(room: Room, playerId: string, socket: WebSocket): void {
    sendTo(socket, { type: 'state', state: this.viewFor(room, playerId) });
  }

  viewFor(room: Room, viewerId: string): TableState {
    const players: PlayerView[] = this.sortedPlayers(room).map((player) => {
      const zones = room.playerZones.get(player.id) ?? emptyZones();
      const isSelf = player.id === viewerId;
      return {
        id: player.id,
        name: player.name,
        seat: player.seat,
        connected: (room.sockets.get(player.id)?.size ?? 0) > 0,
        isHost: player.id === room.hostId,
        // 手牌数只算普通牌；武将牌单独放武将区，不计入。
        handCount: zones.hand.filter((id) => room.cards.get(id)?.category !== 'general').length,
        hp: player.hp,
        team: player.team,
        hand: isSelf ? zones.hand.map((id) => this.cardView(room, id)) : null,
        equipment: zones.equipment.map((id) => this.cardView(room, id)),
        // 武将区：未展示的武将对其他人只下发牌背（有 id、没有牌面信息），张数可见。
        general: zones.general.map((id) => this.generalView(room, id, isSelf)),
      };
    });

    return {
      code: room.code,
      phase: room.phase,
      revision: room.revision,
      selfId: viewerId,
      hostId: room.hostId,
      players,
      deckCounts: {
        general: room.decks.general.length,
        normal: room.decks.normal.length,
      },
      discard: room.discard.map((id) => ({
        ...this.cardView(room, id),
        position: room.discardPositions.get(id) ?? autoDiscardPosition(0),
      })),
      judgment: room.judgment.map((id) => this.cardView(room, id)),
      logs: room.logs.map((entry) => ({ ...entry })),
      chat: room.chat.map((entry) => ({ ...entry })),
      createdAt: room.createdAt,
      maxPlayers: MAX_PLAYERS,
    };
  }

  summary(room: Room): RoomSummary {
    return {
      code: room.code,
      phase: room.phase,
      playerCount: room.players.length,
      maxPlayers: MAX_PLAYERS,
    };
  }

  /** 武将区的牌：未展示的武将对其他人只给牌背。 */
  private generalView(room: Room, cardId: string, isSelf: boolean): CardView {
    const card = room.cards.get(cardId);
    if (card && card.category === 'general' && !card.revealed && !isSelf) {
      return { id: cardId, deck: 'general', name: '武将牌', category: 'general', hidden: true };
    }
    return this.cardView(room, cardId);
  }

  private cardView(room: Room, cardId: string): CardView {
    const card = room.cards.get(cardId);
    if (card) return toCardView(card);
    return {
      id: cardId,
      deck: 'normal',
      name: '未知牌',
      category: 'basic',
    };
  }

  private newPlayer(name: string, seat: number): RoomPlayer {
    return {
      id: `p-${randomBytes(4).toString('hex')}`,
      name,
      seat,
      hp: 4,
      team: null,
      token: randomBytes(24).toString('base64url'),
      joinedAt: Date.now(),
    };
  }

  private sessionFor(room: Room, player: RoomPlayer): Session {
    return {
      roomCode: room.code,
      playerId: player.id,
      token: player.token,
      playerName: player.name,
    };
  }

  private sortedPlayers(room: Room): RoomPlayer[] {
    return [...room.players].sort((a, b) => a.seat - b.seat);
  }

  private addLog(room: Room, text: string, tone: LogEntry['tone']): void {
    room.logs.push({ id: room.nextLogId++, at: Date.now(), text, tone });
    if (room.logs.length > MAX_LOGS) room.logs.splice(0, room.logs.length - MAX_LOGS);
  }

  private touch(room: Room): void {
    room.revision += 1;
    room.updatedAt = Date.now();
  }

  private deleteRoom(room: Room): void {
    if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
    this.rooms.delete(room.code);
  }
}

export class PublicError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function sendTo(socket: WebSocket, message: ServerMessage): void {
  if (socket.readyState === 1) socket.send(JSON.stringify(message));
}

export function parseClientMessage(raw: string): ClientMessage | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== 'object') return null;
    const type = (value as Record<string, unknown>).type;
    if (
      type === 'action' ||
      type === 'start' ||
      type === 'leave' ||
      type === 'chat' ||
      type === 'ping'
    ) {
      return value as ClientMessage;
    }
    return null;
  } catch {
    return null;
  }
}
