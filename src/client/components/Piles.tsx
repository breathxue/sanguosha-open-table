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
  onMoveTop: () => void;
  onShuffle: () => void;
  onDrop: (payload: DragPayload, to: ZoneRef) => void;
}

export function DeckPile({
  deck,
  count,
  disabled,
  onDraw,
  onMoveTop,
  onShuffle,
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
        title={empty ? `${DECK_LABELS[deck]}已经空了` : '轻点摸一张；也可以拖到任意区域，放出牌堆顶的牌'}
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

      <div className="deck-actions">
        <button
          type="button"
          className="deck-draw-button"
          onClick={onDraw}
          disabled={disabled || empty}
        >
          <Icon name="hand" size={14} />
          摸一张
        </button>
        <button
          type="button"
          className="icon-button deck-shuffle"
          onClick={onShuffle}
          disabled={disabled || count < 2}
          title="洗乱牌堆"
          aria-label={`洗乱${DECK_LABELS[deck]}`}
        >
          <Icon name="shuffle" size={15} />
        </button>
      </div>
      <button
        type="button"
        className="deck-move-link"
        onClick={onMoveTop}
        disabled={disabled || empty}
      >
        移动顶牌到…
      </button>
    </DropZone>
  );
}

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
  const zone: ZoneRef = { kind: 'discard' };
  const topCards = cards.slice(0, 3);

  return (
    <DropZone zone={zone} onDrop={onDrop} className="discard-pile">
      <div className="pile-label-row">
        <span className="pile-label">弃牌区</span>
        <span className="pile-count">{cards.length}</span>
      </div>

      <div className={cx('discard-visual', cards.length === 0 && 'is-empty')}>
        {cards.length === 0 ? (
          <div className="empty-discard-slot">
            <Icon name="scroll" size={22} />
            <span>还没有弃牌</span>
          </div>
        ) : (
          <div className="discard-stack">
            {topCards
              .map((card, index) => (
                <div
                  key={card.id}
                  className="discard-card-wrap"
                  style={{
                    transform: `translate(${index * 7}px, ${index * -5}px) rotate(${(index - 1) * 4}deg)`,
                    zIndex: 10 - index,
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
              ))
              .reverse()}
            {cards.length > 3 ? (
              <span className="discard-more">+{cards.length - 3}</span>
            ) : null}
          </div>
        )}
      </div>

      <button type="button" className="discard-open" onClick={onOpen} disabled={cards.length === 0}>
        <Icon name="eye" size={14} />
        {cards.length === 0 ? '暂无弃牌' : '查看弃牌堆'}
      </button>
    </DropZone>
  );
}
