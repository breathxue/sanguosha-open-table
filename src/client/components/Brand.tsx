import { cx } from '../utils';

interface BrandProps {
  compact?: boolean;
  className?: string;
}

export function Brand({ compact = false, className }: BrandProps) {
  return (
    <div className={cx('brand', compact && 'brand--compact', className)}>
      <span className="brand-seal" aria-hidden="true">
        杀
      </span>
      <span className="brand-words">
        <span className="brand-title">三国杀</span>
        <span className="brand-sub">自由牌桌</span>
      </span>
    </div>
  );
}
