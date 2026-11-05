import { Icon } from './Icons';
import type { ToastItem } from '../types';

interface ToastStackProps {
  items: ToastItem[];
  onDismiss: (id: number) => void;
}

export function ToastStack({ items, onDismiss }: ToastStackProps) {
  if (items.length === 0) return null;
  return (
    <div className="toast-stack" aria-live="polite" aria-atomic="false">
      {items.map((item) => (
        <div key={item.id} className={`toast toast--${item.tone}`} role="status">
          <span className="toast-icon">
            <Icon
              name={item.tone === 'error' ? 'alert' : item.tone === 'success' ? 'check' : 'spark'}
              size={16}
            />
          </span>
          <span className="toast-text">{item.message}</span>
          <button
            type="button"
            className="toast-close"
            onClick={() => onDismiss(item.id)}
            aria-label="关闭提示"
          >
            <Icon name="close" size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
