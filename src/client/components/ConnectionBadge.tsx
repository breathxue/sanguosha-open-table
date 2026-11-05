import type { ConnectionStatus } from '../useRoomSocket';
import { cx } from '../utils';
import { Icon } from './Icons';

interface ConnectionBadgeProps {
  status: ConnectionStatus;
  className?: string;
}

const LABELS: Record<ConnectionStatus, string> = {
  idle: '未连接',
  connecting: '连接中',
  online: '已同步',
  offline: '重连中',
  unauthorized: '已断开',
};

export function ConnectionBadge({ status, className }: ConnectionBadgeProps) {
  return (
    <span className={cx('connection-badge', `connection-badge--${status}`, className)}>
      <span className="connection-dot" />
      {status === 'online' ? <Icon name="wifi" size={13} /> : <Icon name="wifi-off" size={13} />}
      <span>{LABELS[status]}</span>
    </span>
  );
}
