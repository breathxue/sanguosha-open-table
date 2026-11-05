import type { DeckKind, PlayerZone, TableState, ZoneRef } from '../../shared/types';
import { DECK_LABELS, ZONE_LABELS } from '../../shared/types';
import type { CardLocation } from '../gameState';
import {
  cardsForIds,
  locateCard,
  playerZoneShortLabel,
  sameZone,
  zoneCount,
  zoneKey,
  zoneName,
} from '../gameState';
import { cx, initialOf } from '../utils';
import { CardBack, PlayingCard } from './PlayingCard';
import { Icon, type IconName } from './Icons';
import { Modal } from './Modal';

export type MoveSource =
  | { kind: 'cards'; cardIds: string[] }
  | { kind: 'deck'; deck: DeckKind };

interface MoveDialogProps {
  state: TableState;
  source: MoveSource;
  onClose: () => void;
  onChoose: (to: ZoneRef) => void;
}

const ZONE_ICON: Record<PlayerZone, IconName> = {
  hand: 'hand',
  equipment: 'shield',
  judgment: 'eye',
  general: 'cards',
};

export function MoveDialog({ state, source, onClose, onChoose }: MoveDialogProps) {
  const locations: CardLocation[] =
    source.kind === 'cards'
      ? source.cardIds
          .map((id) => locateCard(state, id))
          .filter((item): item is CardLocation => Boolean(item))
      : [];
  const cards = source.kind === 'cards' ? cardsForIds(state, source.cardIds) : [];

  const firstZone = locations[0]?.zone ?? null;
  const currentZone =
    firstZone && locations.every((item) => sameZone(item.zone, firstZone)) ? firstZone : null;

  const sourceLabel =
    source.kind === 'deck'
      ? `${DECK_LABELS[source.deck]}顶 · 1 张`
      : currentZone
        ? `${cards.length} 张牌 · 来自${zoneName(state, currentZone)}`
        : `${cards.length} 张牌`;

  const deckTargets: Array<{ deck: DeckKind; icon: string }> = [
    { deck: 'general', icon: '将' },
    { deck: 'normal', icon: '牌' },
  ];

  const choose = (to: ZoneRef) => {
    if (currentZone && sameZone(currentZone, to)) return;
    onChoose(to);
  };

  return (
    <Modal
      title="移动到…"
      subtitle={sourceLabel}
      onClose={onClose}
      size="lg"
      className="move-dialog"
      footer={
        <p className="move-dialog-foot">
          <Icon name="scale" size={14} />
          无规则检查：可以放进任何人的任何区域，包括牌堆和别人的手牌区。
        </p>
      }
    >
      <div className="move-source-strip">
        {source.kind === 'deck' ? (
          <div className="move-source-deck">
            <CardBack deck={source.deck} size="sm" />
            <div>
              <strong>{DECK_LABELS[source.deck]}顶</strong>
              <span>牌面未知，移出后按目标区域决定可见性</span>
            </div>
          </div>
        ) : cards.length > 0 ? (
          <div className="move-source-cards">
            {cards.slice(0, 6).map((card) => (
              <PlayingCard key={card.id} card={card} size="xs" />
            ))}
            {cards.length > 6 ? <span className="move-more">+{cards.length - 6}</span> : null}
          </div>
        ) : (
          <p className="move-empty">这些牌已经不在牌桌上了</p>
        )}
      </div>

      <section className="destination-group">
        <h3>
          <span>公共区域</span>
          <em>PUBLIC</em>
        </h3>
        <div className="public-destinations">
          {deckTargets.map(({ deck, icon }) => {
            const to: ZoneRef = { kind: 'deck', deck };
            const current = currentZone ? sameZone(currentZone, to) : false;
            return (
              <button
                key={deck}
                type="button"
                className={cx('destination-tile', current && 'is-current')}
                onClick={() => choose(to)}
                disabled={current}
                data-to-zone={zoneKey(to)}
              >
                <span className="destination-mark">{icon}</span>
                <span className="destination-text">
                  <strong>{DECK_LABELS[deck]}顶</strong>
                  <small>{state.deckCounts[deck]} 张</small>
                </span>
                {current ? <span className="current-tag">当前</span> : <Icon name="arrow-right" size={15} />}
              </button>
            );
          })}
          <button
            type="button"
            className={cx('destination-tile', currentZone?.kind === 'discard' && 'is-current')}
            onClick={() => choose({ kind: 'discard' })}
            disabled={currentZone?.kind === 'discard'}
            data-to-zone="discard"
          >
            <span className="destination-mark">弃</span>
            <span className="destination-text">
              <strong>弃牌区</strong>
              <small>{state.discard.length} 张</small>
            </span>
            {currentZone?.kind === 'discard' ? (
              <span className="current-tag">当前</span>
            ) : (
              <Icon name="arrow-right" size={15} />
            )}
          </button>
        </div>
      </section>

      <section className="destination-group">
        <h3>
          <span>玩家区域</span>
          <em>PLAYERS</em>
        </h3>
        <div className="player-destinations">
          {state.players.map((player) => (
            <div key={player.id} className="player-destination-row">
              <div className="player-destination-name">
                <span className={cx('mini-avatar', player.id === state.selfId && 'is-self')}>
                  {initialOf(player.name)}
                </span>
                <div>
                  <strong>{player.name}</strong>
                  <small>
                    座位 {player.seat + 1}
                    {player.id === state.selfId ? ' · 你' : ''}
                  </small>
                </div>
              </div>
              <div className="zone-destination-buttons">
                {(['hand', 'equipment', 'judgment', 'general'] as PlayerZone[]).map((zone) => {
                  const to: ZoneRef = { kind: 'player', playerId: player.id, zone };
                  const current = currentZone ? sameZone(currentZone, to) : false;
                  return (
                    <button
                      key={zone}
                      type="button"
                      className={cx('zone-destination', current && 'is-current')}
                      onClick={() => choose(to)}
                      disabled={current}
                      data-to-zone={zoneKey(to)}
                      title={`移动到${player.name}的${ZONE_LABELS[zone]}`}
                    >
                      <Icon name={ZONE_ICON[zone]} size={14} />
                      <span>{playerZoneShortLabel(zone)}</span>
                      <em>{zoneCount(state, to)}</em>
                      {current ? <i>当前</i> : null}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>
    </Modal>
  );
}
