import type { TableState } from '../../shared/types';
import type { ConnectionStatus } from '../useRoomSocket';
import { Brand } from './Brand';
import { ConnectionBadge } from './ConnectionBadge';
import { Icon } from './Icons';

interface TopBarProps {
  state: TableState;
  status: ConnectionStatus;
  onCopyInvite: () => void;
  onLeave: () => void;
  onToggleChat?: () => void;
  chatOpen?: boolean;
}

export function TopBar({
  state,
  status,
  onCopyInvite,
  onLeave,
  onToggleChat,
  chatOpen = false,
}: TopBarProps) {
  const connected = state.players.filter((player) => player.connected).length;

  return (
    <header className="room-topbar">
      <Brand compact />
      <div className="topbar-center">
        <button
          type="button"
          className="room-code-pill"
          onClick={onCopyInvite}
          title="复制邀请链接"
        >
          <span>房间</span>
          <strong>{state.code}</strong>
          <Icon name="copy" size={14} />
        </button>
        <span className={`phase-tag ${state.phase === 'playing' ? 'is-playing' : ''}`}>
          {state.phase === 'playing' ? '牌局进行中' : '等待入席'}
        </span>
      </div>
      <div className="topbar-actions">
        <ConnectionBadge status={status} />
        <span className="topbar-player-count" title="在线 / 在座">
          <Icon name="users" size={15} />
          {connected}/{state.players.length}
        </span>
        {onToggleChat ? (
          <button
            type="button"
            className={`topbar-button chat-toggle ${chatOpen ? 'is-active' : ''}`}
            onClick={onToggleChat}
            aria-label="打开聊天和记录"
          >
            <Icon name="chat" size={17} />
            <span>聊天</span>
          </button>
        ) : null}
        <button
          type="button"
          className="topbar-button topbar-leave"
          onClick={onLeave}
          aria-label="离开牌桌"
        >
          <Icon name="door" size={16} />
          <span>离开</span>
        </button>
      </div>
    </header>
  );
}
