import type { DragEvent } from 'react';
import type { CardView, PlayerView, PlayerZone, Team, ZoneRef } from '../../shared/types';
import { TEAM_LABELS } from '../../shared/types';
import { cx, initialOf } from '../utils';
import type { DragPayload } from '../dnd';
import { CardBack, PlayingCard } from './PlayingCard';
import { DropZone } from './DropZone';
import { Icon } from './Icons';

interface PlayerBoardProps {
  player: PlayerView;
  isSelf: boolean;
  selectedIds: Set<string>;
  onCardClick: (cardId: string) => void;
  onCardDragStart: (cardId: string, event: DragEvent<HTMLDivElement>) => void;
  onCardInfo?: (card: CardView) => void;
  onAdjustHp?: (playerId: string, delta: number) => void;
  onSetHp?: (playerId: string, hp: number) => void;
  onSetTeam?: (playerId: string, team: Team | null) => void;
  onDrop: (payload: DragPayload, to: ZoneRef) => void;
}

const NEXT_TEAM: Record<'none' | Team, Team | null> = { none: 'red', red: 'blue', blue: null };

const ZONE_META: Array<{ zone: Exclude<PlayerZone, 'hand'>; label: string; icon: 'cards' | 'shield' | 'eye' }> = [
  { zone: 'general', label: '武将', icon: 'cards' },
  { zone: 'equipment', label: '装备', icon: 'shield' },
  { zone: 'judgment', label: '判定', icon: 'eye' },
];

export function PlayerBoard({
  player,
  isSelf,
  selectedIds,
  onCardClick,
  onCardDragStart,
  onCardInfo,
  onAdjustHp,
  onSetHp,
  onSetTeam,
  onDrop,
}: PlayerBoardProps) {
  const cardSize = 'xs';
  const team = player.team;
  const hand = player.hand ?? [];
  // 武将区可能放多张武将：按体力最低的那张作为基础体力。
  const generalHps = player.general
    .filter((card) => card.category === 'general' && typeof card.hp === 'number')
    .map((card) => card.hp as number);
  const maxHp = generalHps.length > 0 ? Math.min(...generalHps) : undefined;

  const renderPublicZone = (zone: Exclude<PlayerZone, 'hand'>, label: string, icon: 'cards' | 'shield' | 'eye') => {
    const cards = player[zone];
    const zoneRef: ZoneRef = { kind: 'player', playerId: player.id, zone };
    return (
      <DropZone
        key={zone}
        zone={zoneRef}
        onDrop={onDrop}
        className={cx('player-zone', `player-zone--${zone}`)}
      >
        <div className="zone-heading">
          <span>
            <Icon name={icon} size={12} />
            {label}
          </span>
          <em>{cards.length || ''}</em>
        </div>
        <div className={cx('zone-cards', cards.length === 0 && 'is-empty')}>
          {cards.length === 0 ? (
            <span className="zone-empty">空</span>
          ) : (
            cards.map((card) => (
              <PlayingCard
                key={card.id}
                card={card}
                size={cardSize}
                selected={selectedIds.has(card.id)}
                onClick={() => onCardClick(card.id)}
                onDragStart={(event) => onCardDragStart(card.id, event)}
                onInfo={
                  card.category === 'general' && onCardInfo
                    ? () => onCardInfo(card)
                    : undefined
                }
                className="zone-card"
              />
            ))
          )}
        </div>
      </DropZone>
    );
  };

  return (
    <article
      className={cx(
        'player-board',
        isSelf ? 'player-board--self' : 'player-board--opponent',
        team && `player-board--team-${team}`,
        !player.connected && 'is-disconnected',
      )}
    >
      <header className="player-head">
        <span className={cx('player-avatar', isSelf && 'is-self')}>{initialOf(player.name)}</span>
        <div className="player-identity">
          <div className="player-name-row">
            <strong>{player.name}</strong>
            {isSelf ? <span className="you-badge">你</span> : null}
            {player.isHost ? (
              <span className="host-mark" title="房主">
                <Icon name="crown" size={11} />
              </span>
            ) : null}
            {team ? <span className={`team-badge team-badge--${team}`}>{TEAM_LABELS[team]}</span> : null}
          </div>
          <span className="player-meta">
            <span>座位 {player.seat + 1}</span>
            <i className={cx('status-dot', player.connected && 'is-on')} />
            <span>{player.connected ? '在线' : '离线'}</span>
          </span>
        </div>
        <div className="player-tools">
          {onSetTeam ? (
            <button
              type="button"
              className={cx('team-button', team && `team-button--${team}`)}
              onClick={() => onSetTeam(player.id, NEXT_TEAM[team ?? 'none'])}
              title="队伍标记：点击在 红队 → 蓝队 → 无 之间切换（纯展示）"
              aria-label={`切换${player.name}的队伍标记，当前${team ? TEAM_LABELS[team] : '无'}`}
            >
              {team ? TEAM_LABELS[team][0] : '队'}
            </button>
          ) : null}
          {onAdjustHp ? (
            <div className="hp-control" title="体力（手动调整，牌桌不判定）">
              <button
                type="button"
                className="hp-button"
                onClick={() => onAdjustHp(player.id, -1)}
                disabled={player.hp <= 0}
                aria-label={`减少${player.name}的体力`}
              >
                −
              </button>
              <span className="hp-value">
                <Icon name="heart" size={10} />
                {player.hp}
                {maxHp ? <em>/{maxHp}</em> : null}
              </span>
              <button
                type="button"
                className="hp-button"
                onClick={() => onAdjustHp(player.id, 1)}
                disabled={player.hp >= 99}
                aria-label={`增加${player.name}的体力`}
              >
                +
              </button>
              {onSetHp && maxHp !== undefined ? (
                <button
                  type="button"
                  className="hp-preset-button"
                  onClick={() => onSetHp(player.id, maxHp)}
                  disabled={player.hp === maxHp}
                  title={`按武将基础体力一键设为 ${maxHp}（多武将取最低）`}
                  aria-label={`将${player.name}的体力设为 ${maxHp}`}
                >
                  设{maxHp}
                </button>
              ) : null}
            </div>
          ) : null}
          <span className="player-hand-count" title="手牌数量">
            <Icon name="hand" size={13} />
            {player.handCount}
          </span>
        </div>
      </header>

      <div className="player-zones">
        {ZONE_META.map((meta) => renderPublicZone(meta.zone, meta.label, meta.icon))}
      </div>

      <DropZone
        zone={{ kind: 'player', playerId: player.id, zone: 'hand' }}
        onDrop={onDrop}
        className={cx('player-hand-zone', isSelf ? 'is-self-hand' : 'is-other-hand')}
      >
        <div className="hand-heading">
          <span>
            <Icon name="hand" size={13} />
            手牌
          </span>
          <em>{player.handCount} 张</em>
          {!isSelf ? <span className="hand-private">仅本人可见</span> : null}
        </div>
        {isSelf ? (
          hand.length === 0 ? (
            <div className="hand-empty">
              还没有手牌。把牌堆拖到这里，或点牌堆的「摸一张」。
            </div>
          ) : (
            <div className="self-hand-cards">
              {hand.map((card) => (
                <PlayingCard
                  key={card.id}
                  card={card}
                  size="md"
                  selected={selectedIds.has(card.id)}
                  onClick={() => onCardClick(card.id)}
                  onDragStart={(event) => onCardDragStart(card.id, event)}
                  onInfo={
                    card.category === 'general' && onCardInfo
                      ? () => onCardInfo(card)
                      : undefined
                  }
                  className="hand-card"
                />
              ))}
            </div>
          )
        ) : (
          <div className="hidden-hand">
            {player.handCount === 0 ? (
              <span className="hidden-hand-empty">无手牌</span>
            ) : (
              <div className="card-back-fan">
                {Array.from({ length: Math.min(player.handCount, 8) }, (_, index) => (
                  <CardBack
                    key={index}
                    deck="normal"
                    size="xs"
                    className="hidden-hand-card"
                  />
                ))}
                {player.handCount > 8 ? (
                  <span className="hidden-hand-more">+{player.handCount - 8}</span>
                ) : null}
              </div>
            )}
            <span className="hidden-hand-label">暗牌 · {player.handCount} 张</span>
          </div>
        )}
      </DropZone>
    </article>
  );
}
