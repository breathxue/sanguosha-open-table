import type { DragEvent } from 'react';
import type { DeckKind, ZoneRef } from '../../shared/types';
import { DECK_LABELS } from '../../shared/types';
import { cx } from '../utils';
import type { DragPayload } from '../dnd';
import { writeDragPayload } from '../dnd';
import { CardBack, PlayingCard } from './PlayingCard';
import { DropZone } from './DropZone';
import { Icon } from './Icons';

interface DeckPileProps {
  deck: DeckKind;
  count: number;
  disabled: boolean;
  onDraw: () => void;
  onDrop: (payload: DragPayload, to: ZoneRef) => void;
}

export function DeckPile({
  deck,
  count,
  disabled,
  onDraw,
  onDrop,
}: DeckPileProps) {
  const empty = count === 0;
  const zone: ZoneRef = { kind: 'deck', deck };

  const handleDragStart = (event: DragEvent<HTMLDivElement>) => {
    if (disabled || empty) {
      event.preventDefault();
      return;
    }
    writeDragPayload(event, { kind: 'deck', deck });
  };

  const drawOnClick = () => {
    if (disabled || empty) return;
    onDraw();
  };


  return (
    <DropZone zone={zone} onDrop={onDrop} className="deck-pile">
      <div className="pile-label-row">
        <span className="pile-label">{DECK_LABELS[deck]}</span>
        <span className="pile-count">{count}</span>
      </div>

      <div
        className={cx('deck-visual', empty && 'is-empty')}
        draggable={!disabled && !empty}
        onDragStart={handleDragStart}
        onClick={drawOnClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            drawOnClick();
          }
        }}
        role={empty ? undefined : 'button'}
        tabIndex={empty ? undefined : 0}
        aria-label={empty ? `${DECK_LABELS[deck]}已经空了` : `从${DECK_LABELS[deck]}摸一张，或拖到任意区域`}
        title={empty ? `${DECK_LABELS[deck]}已经空了` : '轻点摸一张；也可以拖到任意区域，放出最上面的一张'}
      >
        {empty ? (
          <div className="empty-deck-slot">
            <Icon name="cards" size={22} />
            <span>空</span>
          </div>
        ) : (
          <div className="deck-stack" aria-label={`${DECK_LABELS[deck]}，${count} 张`}>
            <span className="deck-layer deck-layer--3" />
            <span className="deck-layer deck-layer--2" />
            <CardBack deck={deck} size="md" className="deck-top-card" />
            <span className="deck-gloss" />
            <span className="deck-tap-hint">轻点摸牌</span>
          </div>
        )}
      </div>

    </DropZone>
  );
}

/** 弃牌堆 / 判定区叠放时底下最多垫几层牌背，用来表示厚度。 */
const MAX_STACK_LAYERS = 3;

interface DiscardPileProps {
  cards: import('../../shared/types').CardView[];
  selectedIds: Set<string>;
  onCardClick: (cardId: string) => void;
  onCardDragStart: (cardId: string, event: DragEvent<HTMLDivElement>) => void;
  onOpen: () => void;
  onDrop: (payload: DragPayload, to: ZoneRef) => void;
}

export function DiscardPile({
  cards,
  selectedIds,
  onCardClick,
  onCardDragStart,
  onOpen,
  onDrop,
}: DiscardPileProps) {
  // 开放式弃牌区：每张牌按自己的位置摆在桌面上，最新放进来的（数组头部）画在最上层。
  const zone: ZoneRef = { kind: 'discard' };

  return (
    <div className="discard-pile">
      <div className="pile-label-row">
        <span className="pile-label">弃牌区</span>
        <span className="pile-count">{cards.length}</span>
      </div>

      <DropZone zone={zone} onDrop={onDrop} className={cx('discard-open', cards.length === 0 && 'is-empty')}>
        {cards.length === 0 ? (
          <div className="discard-open-hint" aria-hidden="true">
            <Icon name="scroll" size={22} />
            <span>弃牌放到这里的任意位置</span>
          </div>
        ) : null}
        {cards.map((card, index) => {
          const position = card.position ?? { x: 0.5, y: 0.5 };
          return (
            <div
              key={card.id}
              className="discard-open-card"
              style={{
                left: `${position.x * 100}%`,
                top: `${position.y * 100}%`,
                zIndex: cards.length - index,
              }}
            >
              <PlayingCard
                card={card}
                size="md"
                selected={selectedIds.has(card.id)}
                onClick={() => onCardClick(card.id)}
                onDragStart={(event) => onCardDragStart(card.id, event)}
              />
            </div>
          );
        })}
      </DropZone>

      <button type="button" className="discard-open-button" onClick={onOpen} disabled={cards.length === 0}>
        <Icon name="eye" size={14} />
        {cards.length === 0 ? '暂无弃牌' : '查看弃牌堆'}
      </button>
    </div>
  );
}

interface JudgmentZoneProps {
  cards: import('../../shared/types').CardView[];
  selectedIds: Set<string>;
  onCardClick: (cardId: string) => void;
  onCardDragStart: (cardId: string, event: DragEvent<HTMLDivElement>) => void;
  onDrop: (payload: DragPayload, to: ZoneRef) => void;
}

/** 公共判定区：全桌共用，延时锦囊、判定牌都摆在这里，叠放只露最新放入的一张。 */
export function JudgmentZone({ cards, selectedIds, onCardClick, onCardDragStart, onDrop }: JudgmentZoneProps) {
  const zone: ZoneRef = { kind: 'judgment' };
  // 判定区叠放：服务端按放入顺序追加，最新放进来的在数组末尾，露出它。
  const top = cards.length > 0 ? cards[cards.length - 1] : null;
  const layers = Math.min(MAX_STACK_LAYERS, Math.max(0, cards.length - 1));

  return (
    <DropZone zone={zone} onDrop={onDrop} className={cx('judgment-zone', cards.length === 0 && 'is-empty')}>
      <div className="pile-label-row">
        <span className="pile-label">判定区</span>
        <span className="pile-count">{cards.length}</span>
      </div>

      <div className="judgment-visual">
        {top === null ? (
          <div className="empty-judgment-slot">
            <Icon name="eye" size={22} />
            <span>判定牌放这里</span>
          </div>
        ) : (
          <div className="card-stack" aria-label={`判定区，${cards.length} 张，最上面是${top.name}`}>
            {Array.from({ length: layers }, (_, index) => (
              <span
                key={`layer-${index}`}
                className="card-stack-layer"
                style={{
                  transform: `translate(${(layers - index) * 4}px, ${(layers - index) * -3}px) rotate(${(layers - index) * 1.5}deg)`,
                }}
                aria-hidden="true"
              />
            ))}
            <PlayingCard
              card={top}
              size="md"
              selected={selectedIds.has(top.id)}
              onClick={() => onCardClick(top.id)}
              onDragStart={(event) => onCardDragStart(top.id, event)}
              className="card-stack-top"
            />
            {cards.length > 1 ? (
              <span className="card-stack-more" title="下面还压着更多判定牌，拖走上面的就能看到下一张">
                +{cards.length - 1}
              </span>
            ) : null}
          </div>
        )}
      </div>

      <span className="judgment-hint">
        <Icon name="move" size={12} />
        拖牌进来即可放入
      </span>
    </DropZone>
  );
}
