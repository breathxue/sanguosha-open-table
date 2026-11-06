import type { DragEvent, KeyboardEvent } from 'react';
import type { CardView, DeckKind, Suit } from '../../shared/types';
import { cx } from '../utils';
import { kingdomClass } from '../kingdoms';

export type CardSize = 'xs' | 'sm' | 'md' | 'lg';

const SUIT_SYMBOL: Record<Suit, string> = {
  spade: '♠',
  heart: '♥',
  club: '♣',
  diamond: '♦',
};

const SUIT_NAME: Record<Suit, string> = {
  spade: '黑桃',
  heart: '红桃',
  club: '梅花',
  diamond: '方块',
};

const CATEGORY_LABEL: Record<CardView['category'], string> = {
  basic: '基本',
  trick: '锦囊',
  equipment: '装备',
  general: '武将',
};

const CATEGORY_SEAL: Record<CardView['category'], string> = {
  basic: '杀',
  trick: '锦',
  equipment: '备',
  general: '将',
};

interface PlayingCardProps {
  card: CardView;
  size?: CardSize;
  selected?: boolean;
  onClick?: () => void;
  onDragStart?: (event: DragEvent<HTMLDivElement>) => void;
  onInfo?: () => void;
  className?: string;
}

export function PlayingCard({
  card,
  size = 'md',
  selected = false,
  onClick,
  onDragStart,
  onInfo,
  className,
}: PlayingCardProps) {
  const isGeneral = card.category === 'general';
  const hasArt = isGeneral && Boolean(card.image);
  const red = card.suit === 'heart' || card.suit === 'diamond';
  const interactive = Boolean(onClick) || Boolean(onDragStart);
  const cardTitle = isGeneral
    ? `${card.kingdom ?? ''} · ${card.name}${card.hp ? ` · ${card.hp} 体力` : ''}`
    : `${card.suit ? SUIT_NAME[card.suit] : ''}${card.rank ?? ''} · ${card.name}`;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!onClick) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={cx(
        'playing-card',
        isGeneral ? 'playing-card--general' : 'playing-card--normal',
        isGeneral && `playing-card--${kingdomClass(card.kingdom)}`,
        hasArt && 'has-art',
        `playing-card--${size}`,
        selected && 'is-selected',
        interactive && 'is-interactive',
        className,
      )}
      data-card-id={card.id}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? selected : undefined}
      aria-label={cardTitle}
      title={cardTitle}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      draggable={Boolean(onDragStart)}
      onDragStart={onDragStart}
    >
      {isGeneral ? (
        <>
          {hasArt ? (
            <img
              className="general-art"
              src={card.image}
              alt=""
              draggable={false}
              loading="lazy"
              decoding="async"
            />
          ) : null}
          <div className="card-sheen" />
          <div className="general-topline">
            <span className="kingdom-seal">{card.kingdom}</span>
            {onInfo ? (
              <button
                type="button"
                className="card-info-button"
                onClick={(event) => {
                  event.stopPropagation();
                  onInfo();
                }}
                onKeyDown={(event) => event.stopPropagation()}
                onMouseDown={(event) => event.stopPropagation()}
                aria-label={`查看${card.name}的技能描述`}
                title="查看技能描述"
              >
                技
              </button>
            ) : null}
          </div>
          <div className="general-name">{card.name}</div>
          {hasArt ? <div className="general-art-name">{card.name}</div> : null}
          {card.skills && card.skills.length > 0 ? (
            <div className="general-skills">{card.skills.map((skill) => skill.name).join(' · ')}</div>
          ) : null}
          <div className="general-bottom">
            <span className="general-hp" aria-hidden="true">
              {Array.from({ length: Math.min(card.hp ?? 0, 5) }, (_, index) => (
                <i key={index} />
              ))}
            </span>
            <span className="general-hp-label">{card.hp ?? 4} 体力</span>
          </div>
        </>
      ) : (
        <>
          <div className="card-sheen" />
          <div className={cx('card-corner', red && 'is-red')}>
            <span className="card-rank">{card.rank}</span>
            <span className="card-suit">{card.suit ? SUIT_SYMBOL[card.suit] : ''}</span>
          </div>
          <div className="card-center">
            <span
              className={cx(
                'card-name',
                [...card.name].length >= 4 && 'is-long',
                [...card.name].length >= 5 && 'is-very-long',
              )}
            >
              {card.name}
            </span>
            <span className="card-category">{CATEGORY_LABEL[card.category]}</span>
          </div>
          <div className={cx('card-bottom', red && 'is-red')}>
            <span>{card.suit ? SUIT_SYMBOL[card.suit] : ''}</span>
            <span>{card.rank}</span>
          </div>
          <span className="card-seal">{CATEGORY_SEAL[card.category]}</span>
        </>
      )}
    </div>
  );
}

interface CardBackProps {
  deck: DeckKind;
  size?: CardSize;
  className?: string;
  label?: string;
}

export function CardBack({ deck, size = 'md', className, label }: CardBackProps) {
  return (
    <div
      className={cx(
        'card-back',
        `card-back--${deck}`,
        `card-back--${size}`,
        className,
      )}
      aria-label={label ?? (deck === 'general' ? '武将牌背面' : '普通牌背面')}
    >
      <span className="card-back-frame" />
      <span className="card-back-emblem">{deck === 'general' ? '◆' : '杀'}</span>
      <span className="card-back-dots" aria-hidden="true" />
    </div>
  );
}
