import type { CSSProperties, DragEvent } from 'react';
import type { CardView, PlayerView, Team, ZoneRef } from '../../shared/types';
import { TEAM_LABELS } from '../../shared/types';
import { cx } from '../utils';
import type { DragPayload } from '../dnd';
import { CardBack, PlayingCard } from './PlayingCard';
import { DropZone } from './DropZone';
import { Icon } from './Icons';

/**
 * 牌桌上的一个座位：左侧竖条（名字 / 体力 / 手牌数），右侧武将叠放。
 * 对手的座位把装备压成一行小槽位放在武将旁；
 * 自己的座位（isSelf）不放这一行，而是在右侧依次展开手牌区和装备区（4 个槽位）。
 * 判定区不再按玩家划分，统一放在公共牌区（见 Piles.tsx 的 JudgmentZone）。
 */

interface SeatCardProps {
  player: PlayerView;
  isSelf: boolean;
  selectedIds: Set<string>;
  onCardClick: (cardId: string) => void;
  onCardDragStart: (cardId: string, event: DragEvent<HTMLDivElement>) => void;
  onCardInfo?: (card: CardView) => void;
  /** 自己的座位：把一张未展示的武将展示给全桌。 */
  onReveal?: (cardId: string) => void;
  onAdjustHp?: (playerId: string, delta: number) => void;
  onSetHp?: (playerId: string, hp: number) => void;
  onSetTeam?: (playerId: string, team: Team | null) => void;
  onDrop: (payload: DragPayload, to: ZoneRef) => void;
}

const NEXT_TEAM: Record<'none' | Team, Team | null> = { none: 'red', red: 'blue', blue: null };

/** 武将区最多叠放展示的张数；再多的放进「+N」提示里。 */
const MAX_STACK = 3;
/** 竖条里最多画多少颗心，超过只显示数字。 */
const MAX_HEARTS = 10;
/** 自己装备区固定画出的槽位数（武器、防具、进攻马、防御马）。 */
const EQUIPMENT_SLOTS = 4;

export function SeatCard({
  player,
  isSelf,
  selectedIds,
  onCardClick,
  onCardDragStart,
  onCardInfo,
  onReveal,
  onAdjustHp,
  onSetHp,
  onSetTeam,
  onDrop,
}: SeatCardProps) {
  const team = player.team;
  const hand = player.hand ?? [];
  const generals = player.general;
  const stacked = generals.slice(0, MAX_STACK);
  const hiddenGenerals = generals.length - stacked.length;

  // 武将区可能放多张武将：按体力最低的那张作为基础体力。
  const generalHps = generals
    .filter((card) => card.category === 'general' && typeof card.hp === 'number')
    .map((card) => card.hp as number);
  const maxHp = generalHps.length > 0 ? Math.min(...generalHps) : undefined;
  const heartTotal = Math.max(player.hp, maxHp ?? 0);
  const showHearts = heartTotal > 0 && heartTotal <= MAX_HEARTS;

  const playerZone = (zone: 'hand' | 'equipment' | 'general'): ZoneRef => ({
    kind: 'player',
    playerId: player.id,
    zone,
  });

  /** 对手卡上的装备区：整张小牌面（xs）展示，空位画虚线槽，固定 4 槽。 */
  const renderMiniZone = (zone: 'equipment', label: string, icon: 'shield', slots: number) => {
    const cards = player[zone];
    const placeholders = Math.max(0, slots - cards.length);
    return (
      <DropZone
        key={zone}
        zone={playerZone(zone)}
        onDrop={onDrop}
        className={cx('seat-mini', `seat-mini--${zone}`, cards.length === 0 && 'is-empty')}
      >
        <span className="seat-mini-label" title={label}>
          <Icon name={icon} size={10} />
          {label}
          {cards.length > 0 ? <em>{cards.length}</em> : null}
        </span>
        <div className="seat-mini-cards">
          {cards.map((card) => (
            <PlayingCard
              key={card.id}
              card={card}
              size="xs"
              selected={selectedIds.has(card.id)}
              onClick={() => onCardClick(card.id)}
              onDragStart={(event) => onCardDragStart(card.id, event)}
              className="seat-mini-card"
            />
          ))}
          {Array.from({ length: placeholders }, (_, index) => (
            <span className="seat-mini-slot" key={`slot-${index}`} aria-hidden="true" />
          ))}
        </div>
      </DropZone>
    );
  };

  /** 自己座位底部的独立区域：装备区，整张牌面展示，空位画虚线槽。 */
  const renderSelfZone = (zone: 'equipment', label: string, icon: 'shield', slots: number) => {
    const cards = player[zone];
    const placeholders = Math.max(0, slots - cards.length);
    return (
      <DropZone
        key={zone}
        zone={playerZone(zone)}
        onDrop={onDrop}
        className={cx('seat-zone', `seat-zone--${zone}`, cards.length === 0 && 'is-empty')}
      >
        <div className="seat-zone-head">
          <span>
            <Icon name={icon} size={12} />
            {label}
          </span>
          <em>{cards.length} 张</em>
        </div>
        <div className="seat-zone-cards">
          {cards.map((card) => (
            <PlayingCard
              key={card.id}
              card={card}
              size="sm"
              selected={selectedIds.has(card.id)}
              onClick={() => onCardClick(card.id)}
              onDragStart={(event) => onCardDragStart(card.id, event)}
              onInfo={card.category === 'general' && onCardInfo ? () => onCardInfo(card) : undefined}
              className="seat-zone-card"
            />
          ))}
          {Array.from({ length: placeholders }, (_, index) => (
            <span className="seat-zone-slot" key={`slot-${index}`} aria-hidden="true" />
          ))}
        </div>
      </DropZone>
    );
  };

  return (
    <article
      className={cx(
        'seat-card',
        isSelf ? 'seat-card--self' : 'seat-card--opponent',
        team && `seat-card--team-${team}`,
        !player.connected && 'is-disconnected',
      )}
      aria-label={`${player.name}的座位`}
    >
      <DropZone
        zone={playerZone('hand')}
        onDrop={onDrop}
        className="seat-side"
      >
        <div className="seat-side-top">
          {player.isHost ? (
            <span className="seat-host" title="房主">
              <Icon name="crown" size={10} />
            </span>
          ) : null}
          {isSelf ? <span className="seat-you">你</span> : null}
          <span className="seat-name" title={player.name}>
            {player.name}
          </span>
        </div>
        <div className="seat-side-bottom">
          <span
            className="seat-hp"
            title={`体力 ${player.hp}${maxHp ? ` / ${maxHp}` : ''}`}
            aria-label={`体力 ${player.hp}${maxHp ? `，上限 ${maxHp}` : ''}`}
          >
            {showHearts ? (
              <span className="seat-hearts" aria-hidden="true">
                {Array.from({ length: heartTotal }, (_, index) => (
                  <i key={index} className={cx(index < player.hp ? 'is-on' : 'is-off')}>
                    <Icon name="heart" size={9} />
                  </i>
                ))}
              </span>
            ) : null}
            <strong className={cx(player.hp <= 1 && 'is-danger')}>{player.hp}</strong>
          </span>
          <span className="seat-hand-count" title={`手牌 ${player.handCount} 张${isSelf ? '' : '（仅本人可见）'}`}>
            <Icon name="hand" size={11} />
            {player.handCount}
          </span>
          {!player.connected ? <span className="seat-offline">离线</span> : null}
        </div>
      </DropZone>

      <div className="seat-main">
        <DropZone
          zone={playerZone('general')}
          onDrop={onDrop}
          className={cx('seat-generals', generals.length === 0 && 'is-empty')}
        >
          {generals.length === 0 ? (
            <span className="seat-generals-empty">
              <Icon name="cards" size={14} />
              武将
            </span>
          ) : (
            <div
              className="general-stack"
              style={{ '--stack-n': stacked.length } as CSSProperties}
            >
              {stacked.map((card, index) => (
                <div className="general-stack-slot" style={{ '--i': index } as CSSProperties} key={card.id}>
                  {card.hidden ? (
                    <CardBack
                      deck="general"
                      size="md"
                      className="general-stack-back"
                      label={`${player.name}未展示的武将`}
                    />
                  ) : (
                    <PlayingCard
                      card={card}
                      size="md"
                      sideName
                      selected={selectedIds.has(card.id)}
                      // 点武将 = 放大看图（自己的和对方已展示的都可以）；拖拽仍然可以直接搬动。
                      onClick={() =>
                        card.category === 'general' && onCardInfo ? onCardInfo(card) : onCardClick(card.id)
                      }
                      onDragStart={(event) => onCardDragStart(card.id, event)}
                      onInfo={card.category === 'general' && onCardInfo ? () => onCardInfo(card) : undefined}
                      className="general-stack-card"
                    />
                  )}
                  {isSelf && card.category === 'general' ? (
                    // 标记放在每张牌左下角（叠放时露出的那一条里），每张都点得到。
                    card.revealed ? (
                      <span className="general-reveal-tag is-revealed" title="已向全桌展示" aria-label="已展示">
                        <Icon name="eye" size={10} />
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="general-reveal-tag general-reveal-button"
                        title={`展示【${card.name}】给全桌，之后不可收回`}
                        aria-label={`展示武将 ${card.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          onReveal?.(card.id);
                        }}
                        disabled={!onReveal}
                      >
                        <Icon name="eye" size={10} />
                      </button>
                    )
                  ) : null}
                </div>
              ))}
              {hiddenGenerals > 0 ? (
                <span className="general-stack-more" title={`武将区还有 ${hiddenGenerals} 张未展示`}>
                  +{hiddenGenerals}
                </span>
              ) : null}
            </div>
          )}
        </DropZone>

        <div className={cx('seat-rows', isSelf && 'seat-rows--self')}>
          {isSelf ? null : renderMiniZone('equipment', '装备', 'shield', EQUIPMENT_SLOTS)}
          <div className={cx('seat-mini-row', isSelf && 'seat-mini-row--self')}>
          <div className="seat-tools">
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
          </div>
          </div>
        </div>
      </div>

      {isSelf ? (
        <DropZone
          zone={playerZone('hand')}
          onDrop={onDrop}
          className="seat-hand"
        >
          <div className="seat-hand-head">
            <span>
              <Icon name="hand" size={12} />
              手牌
            </span>
            <em>{player.handCount} 张</em>
            <span className="seat-hand-hint">只有你能看见</span>
          </div>
          {hand.length === 0 ? (
            <div className="hand-empty">还没有手牌。把牌堆拖到这里，或点牌堆的「摸一张」。</div>
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
                  onInfo={card.category === 'general' && onCardInfo ? () => onCardInfo(card) : undefined}
                  className="hand-card"
                />
              ))}
            </div>
          )}
        </DropZone>
      ) : null}

      {isSelf ? renderSelfZone('equipment', '装备', 'shield', EQUIPMENT_SLOTS) : null}
    </article>
  );
}
