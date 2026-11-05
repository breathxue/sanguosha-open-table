import type { CardView, PlayerZone, TableState, ZoneRef } from '../shared/types';
import { DECK_LABELS, ZONE_LABELS } from '../shared/types';

export interface CardLocation {
  card: CardView;
  zone: ZoneRef;
}

export function zoneKey(zone: ZoneRef): string {
  if (zone.kind === 'deck') return `deck:${zone.deck}:${zone.placement ?? 'top'}`;
  if (zone.kind === 'discard') return 'discard';
  return `player:${zone.playerId}:${zone.zone}`;
}

export function sameZone(a: ZoneRef | null, b: ZoneRef | null): boolean {
  if (!a || !b) return false;
  return zoneKey(a) === zoneKey(b);
}

export function locateCard(state: TableState, cardId: string): CardLocation | null {
  for (const player of state.players) {
    if (player.hand) {
      const card = player.hand.find((item) => item.id === cardId);
      if (card) {
        return { card, zone: { kind: 'player', playerId: player.id, zone: 'hand' } };
      }
    }
    for (const zone of ['equipment', 'judgment', 'general'] as Array<Exclude<PlayerZone, 'hand'>>) {
      const card = player[zone].find((item) => item.id === cardId);
      if (card) {
        return { card, zone: { kind: 'player', playerId: player.id, zone } };
      }
    }
  }
  const discardCard = state.discard.find((item) => item.id === cardId);
  if (discardCard) return { card: discardCard, zone: { kind: 'discard' } };
  return null;
}

export function visibleCardIds(state: TableState): Set<string> {
  const ids = new Set<string>();
  for (const player of state.players) {
    for (const card of player.hand ?? []) ids.add(card.id);
    for (const card of player.equipment) ids.add(card.id);
    for (const card of player.judgment) ids.add(card.id);
    for (const card of player.general) ids.add(card.id);
  }
  for (const card of state.discard) ids.add(card.id);
  return ids;
}

export function cardsForIds(state: TableState, ids: string[]): CardView[] {
  return ids
    .map((id) => locateCard(state, id)?.card ?? null)
    .filter((card): card is CardView => Boolean(card));
}

export function zoneCount(state: TableState, zone: ZoneRef): number {
  if (zone.kind === 'deck') return state.deckCounts[zone.deck];
  if (zone.kind === 'discard') return state.discard.length;
  const player = state.players.find((item) => item.id === zone.playerId);
  if (!player) return 0;
  if (zone.zone === 'hand') return player.handCount;
  return player[zone.zone].length;
}

export function zoneName(
  state: TableState,
  zone: ZoneRef,
  perspectiveId = state.selfId,
): string {
  if (zone.kind === 'deck') return `${DECK_LABELS[zone.deck]}${(zone.placement ?? 'top') === 'bottom' ? '底' : '顶'}`;
  if (zone.kind === 'discard') return '弃牌区';
  const player = state.players.find((item) => item.id === zone.playerId);
  const owner = player?.id === perspectiveId ? '我的' : `${player?.name ?? '未知玩家'}的`;
  return `${owner}${ZONE_LABELS[zone.zone]}`;
}

export function playerZoneShortLabel(zone: PlayerZone): string {
  return ZONE_LABELS[zone].replace('区', '');
}
