import type { ReactNode } from 'react';
import type { CardView, SkillTag } from '../../shared/types';
import { cx } from '../utils';
import { kingdomClass } from '../kingdoms';
import { Icon } from './Icons';
import { Modal } from './Modal';

interface GeneralDetailModalProps {
  card: CardView;
  onClose: () => void;
  /** 放在底部的操作按钮，例如「展示给全桌」。 */
  actions?: ReactNode;
}

const TAG_LABEL: Record<SkillTag, string> = {
  lord: '主公技',
  awakening: '觉醒技',
  limited: '限定技',
  locked: '锁定技',
};

export function GeneralDetailModal({ card, onClose, actions }: GeneralDetailModalProps) {
  const hp = card.hp ?? 4;
  return (
    <Modal
      title={card.name}
      subtitle={`${card.kingdom ?? ''}势力 · 基础体力 ${hp}${card.revealed ? ' · 已向全桌展示' : ''}`}
      onClose={onClose}
      size="lg"
      className="general-detail-modal"
      footer={
        <>
          <p className="general-detail-note">
            <Icon name="scale" size={14} />
            技能文本仅作参考，牌桌不会自动结算。
          </p>
          {actions ? <div className="general-detail-actions">{actions}</div> : null}
        </>
      }
    >
      <div className={cx('general-detail', 'general-detail--zoom', kingdomClass(card.kingdom))}>
        {card.image ? (
          <figure className="general-detail-zoom">
            <img className="general-detail-zoom-art" src={card.image} alt={`${card.name}牌面`} />
          </figure>
        ) : null}
        <div className="general-detail-body">
        <div className="general-detail-hero">
          <span className="general-detail-kingdom">{card.kingdom}</span>
          <div className="general-detail-stats">
            <span>基础体力</span>
            <div className="general-detail-hp" aria-label={`${hp} 点体力`}>
              {Array.from({ length: Math.min(hp, 8) }, (_, index) => (
                <i key={index} />
              ))}
              <strong>{hp}</strong>
            </div>
          </div>
          <div className="general-detail-skills-count">
            <strong>{card.skills?.length ?? 0}</strong>
            <span>技能</span>
          </div>
        </div>

        <div className="general-skill-list">
          {(card.skills ?? []).length === 0 ? (
            <p className="general-skill-empty">这名武将暂无技能描述。</p>
          ) : (
            card.skills?.map((skill) => (
              <article className="general-skill-card" key={skill.name}>
                <header>
                  <h3>{skill.name}</h3>
                  <div className="general-skill-tags">
                    {skill.tags?.map((tag) => (
                      <span key={tag} className={`skill-tag skill-tag--${tag}`}>
                        {TAG_LABEL[tag]}
                      </span>
                    ))}
                  </div>
                </header>
                <p>{skill.description}</p>
              </article>
            ))
          )}
        </div>
        </div>
      </div>
    </Modal>
  );
}
