import { randomBytes, randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import {
  DECK_LABELS,
  MAX_PLAYERS,
  ROOM_CODE_LENGTH,
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
  type TableState,
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
  token: string;
  joinedAt: number;
}

export interface PlayerZones {
  hand: string[];
  equipment: string[];
  judgment: string[];
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
}

export interface ActionResult {
  ok: boolean;
  error?: string;
}

type CardLocation =
  | { kind: 'deck'; deck: DeckKind; placement?: 'top' | 'bottom' }
  | { kind: 'discard' }
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
  return typeof value === 'string' ? value.trim().toUpperCase().slice(0, ROOM_CODE_LENGTH) : '';
}

function emptyZones(): PlayerZones {
  return { hand: [], equipment: [], judgment: [], general: [] };
}

function findCardLocation(room: Room, cardId: string): CardLocation | null {
  if (room.decks.normal.includes(cardId)) return { kind: 'deck', deck: 'normal' };
  if (room.decks.general.includes(cardId)) return { kind: 'deck', deck: 'general' };
  if (room.discard.includes(cardId)) return { kind: 'discard' };

  for (const [playerId, zones] of room.playerZones) {
    for (const zone of ['hand', 'equipment', 'judgment', 'general'] as PlayerZone[]) {
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
    target = room.discard;
    for (let i = cardIds.length - 1; i >= 0; i -= 1) target.unshift(cardIds[i]);
    return;
  }
  const zones = room.playerZones.get(to.playerId);
  if (!zones) return;
  target = zones[to.zone];
  target.push(...cardIds);
}

function sameZone(a: CardLocation, b: ZoneRef): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'deck' && b.kind === 'deck') {
    return a.deck === b.deck && (a.placement ?? 'top') === (b.placement ?? 'top');
  }
  if (a.kind === 'discard' && b.kind === 'discard') return true;
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
  if (zone.kind === 'discard') return true;
  if (zone.kind === 'player') {
    return (
      typeof zone.playerId === 'string' &&
      room.players.some((player) => player.id === zone.playerId) &&
      (zone.zone === 'hand' ||
        zone.zone === 'equipment' ||
        zone.zone === 'judgment' ||
        zone.zone === 'general')
    );
  }
  return false;
}

function describeLocation(room: Room, viewerId: string, location: CardLocation): string {
  if (location.kind === 'deck') return DECK_LABELS[location.deck];
  if (location.kind === 'discard') return '弃牌区';
  const player = room.players.find((item) => item.id === location.playerId);
  if (!player) return ZONE_LABELS[location.zone];
  return `${player.id === viewerId ? '自己的' : `${player.name}的`}${ZONE_LABELS[location.zone]}`;
}

function describeDestination(room: Room, viewerId: string, to: ZoneRef): string {
  if (to.kind === 'deck') return `${DECK_LABELS[to.deck]}${(to.placement ?? 'top') === 'bottom' ? '底' : '顶'}`;
  if (to.kind === 'discard') return '弃牌区';
  const player = room.players.find((item) => item.id === to.playerId);
  if (!player) return ZONE_LABELS[to.zone];
  return `${player.id === viewerId ? '自己的' : `${player.name}的`}${ZONE_LABELS[to.zone]}`;
}

function isHiddenLocation(location: CardLocation): boolean {
  return location.kind === 'deck' || (location.kind === 'player' && location.zone === 'hand');
}

function isHiddenDestination(to: ZoneRef): boolean {
  return to.kind === 'deck' || (to.kind === 'player' && to.zone === 'hand');
}

export class RoomStore {
  readonly rooms = new Map<string, Room>();

  createRoom(rawName: unknown): RoomSession {
    const name = cleanPlayerName(rawName);
    const code = makeRoomCode(this.rooms);
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
    return { room, player, session: this.sessionFor(room, player) };
  }

  joinRoom(rawCode: unknown, rawName: unknown): RoomSession {
    const code = normalizeRoomCode(rawCode);
    const room = this.rooms.get(code);
    if (!room) throw new PublicError('房间不存在，或已经结束', 404);
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
    this.addLog(
      room,
      room.phase === 'playing' ? `${name} 加入了牌桌` : `${name} 加入了房间`,
      'muted',
    );
    this.touch(room);
    return { room, player, session: this.sessionFor(room, player) };
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
    this.touch(room);
    return { ok: true };
  }

  performAction(room: Room, playerId: string, action: TableAction): ActionResult {
    const player = room.players.find((item) => item.id === playerId);
    if (!player) return { ok: false, error: '你已不在牌桌中' };
    if (room.phase !== 'playing') return { ok: false, error: '牌局还没有开始' };
    if (!action || typeof action !== 'object' || typeof action.type !== 'string') {
      return { ok: false, error: '无法识别的操作' };
    }

    if (action.type === 'adjustHp') {
      if (typeof action.playerId !== 'string') {
        return { ok: false, error: '无法识别要调整体力的玩家' };
      }
      const target = room.players.find((item) => item.id === action.playerId);
      if (!target) return { ok: false, error: '目标玩家已经不在牌桌上了' };
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
      putCardsAt(room, [cardId], action.to);
      const card = room.cards.get(cardId);
      const toHand = action.to.kind === 'player' && action.to.zone === 'hand';
      const toDeck = action.to.kind === 'deck';
      const toOwnHand = toHand && action.to.kind === 'player' && action.to.playerId === player.id;
      const dest = describeDestination(room, player.id, action.to);
      if (toOwnHand) {
        this.addLog(room, `${player.name} 从${DECK_LABELS[action.deck]}摸了 1 张牌`, 'normal');
      } else if (toHand) {
        this.addLog(room, `${player.name} 将${DECK_LABELS[action.deck]}顶的 1 张牌放入${dest}`, 'normal');
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
        if (isHiddenLocation(location)) {
          const ownHand =
            location.kind === 'player' &&
            location.playerId === player.id &&
            location.zone === 'hand';
          if (!ownHand) return { ok: false, error: '不能移动尚未公开的牌' };
        }
      }

      if (located.every((item) => sameZone(item.location!, action.to))) {
        return { ok: false, error: '这些牌已经在目标区域了' };
      }

      const fromDescriptions = [
        ...new Set(located.map((item) => describeLocation(room, player.id, item.location!))),
      ];
      const firstLocation = located[0].location!;
      const onlyOneZone = located.every((item) => sameZone(item.location!, firstLocation));
      const hiddenSource = located.some((item) => isHiddenLocation(item.location!));
      const hiddenDestination = isHiddenDestination(action.to);
      const cardViews = cardIds
        .map((id) => room.cards.get(id))
        .filter((card): card is Card => Boolean(card));

      for (const item of located) {
        removeCardFrom(room, item.cardId, item.location!);
      }
      putCardsAt(room, cardIds, action.to);

      let phrase = `${cardIds.length} 张牌`;
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
      const dest = describeDestination(room, player.id, action.to);
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
          ...zones.judgment,
          ...zones.general,
        ];
        if (orphaned.length > 0) {
          for (let i = orphaned.length - 1; i >= 0; i -= 1) room.discard.unshift(orphaned[i]);
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
        handCount: zones.hand.length,
        hp: player.hp,
        hand: isSelf ? zones.hand.map((id) => this.cardView(room, id)) : null,
        equipment: zones.equipment.map((id) => this.cardView(room, id)),
        judgment: zones.judgment.map((id) => this.cardView(room, id)),
        general: zones.general.map((id) => this.cardView(room, id)),
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
      discard: room.discard.map((id) => this.cardView(room, id)),
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
