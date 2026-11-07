import { useState } from 'react';
import type { CardView } from '../../shared/types';
import { GENERAL_KEEP_COUNT } from '../../shared/types';
import { cx } from '../utils';
import { Icon } from './Icons';
import { Modal } from './Modal';
import { PlayingCard } from './PlayingCard';

/**
 * 开局选将：武将区里的武将超过保留数时弹出，勾选要保留的，其余放回武将牌堆底。
 * 不强制：可以「稍后再选」，武将区里多放几张也不拦。
 */

interface GeneralPickModalProps {
  generals: CardView[];
  onKeep: (keepIds: string[], returnIds: string[]) => void;
  onInfo: (card: CardView) => void;
  onClose: () => void;
}

export function GeneralPickModal({ generals, onKeep, onInfo, onClose }: GeneralPickModalProps) {
  const [keep, setKeep] = useState<Set<string>>(() => new Set());
  const keepCount = keep.size;
  const ready = keepCount === GENERAL_KEEP_COUNT;

  const toggle = (id: string) => {
    setKeep((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else if (next.size < GENERAL_KEEP_COUNT) next.add(id);
      return next;
    });
  };

  const confirm = () => {
    if (!ready) return;
    const keepIds = generals.filter((card) => keep.has(card.id)).map((card) => card.id);
    const returnIds = generals.filter((card) => !keep.has(card.id)).map((card) => card.id);
    onKeep(keepIds, returnIds);
  };

  return (
    <Modal
      title="选将"
      subtitle={`摸到 ${generals.length} 张武将，保留 ${GENERAL_KEEP_COUNT} 张，其余放回武将牌堆底。武将只有你能看见，点「详情」看技能。`}
      onClose={onClose}
      size="lg"
      className="general-pick-modal"
      footer={
        <>
          <span className="pile-modal-count">
            已选 {keepCount} / {GENERAL_KEEP_COUNT}
          </span>
          <button type="button" className="ghost-button" onClick={onClose}>
            稍后再选
          </button>
          <button type="button" className="primary-button" onClick={confirm} disabled={!ready}>
            <Icon name="check" size={15} />
            保留这 {GENERAL_KEEP_COUNT} 张
          </button>
        </>
      }
    >
      <div className="general-pick-grid">
        {generals.map((card) => {
          const picked = keep.has(card.id);
          return (
            <div key={card.id} className={cx('general-pick-item', picked && 'is-picked')}>
              <PlayingCard
                card={card}
                size="lg"
                selected={picked}
                onClick={() => toggle(card.id)}
                onInfo={() => onInfo(card)}
              />
              <span className="general-pick-tag">{picked ? '保留' : '放回牌堆底'}</span>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
