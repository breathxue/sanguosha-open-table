import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { TableState } from '../../shared/types';
import { cx, formatTime, initialOf } from '../utils';
import { Icon } from './Icons';

interface SidePanelProps {
  state: TableState;
  open: boolean;
  onClose: () => void;
  onSendChat: (text: string) => boolean;
}

type SideTab = 'log' | 'chat';

export function SidePanel({ state, open, onClose, onSendChat }: SidePanelProps) {
  const [tab, setTab] = useState<SideTab>('log');
  const [draft, setDraft] = useState('');
  const logEndRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (tab === 'log') logEndRef.current?.scrollIntoView({ block: 'end' });
  }, [state.logs.length, tab]);

  useEffect(() => {
    if (tab === 'chat') chatEndRef.current?.scrollIntoView({ block: 'end' });
  }, [state.chat.length, tab]);

  useEffect(() => {
    if (open && tab === 'chat') {
      window.setTimeout(() => chatInputRef.current?.focus(), 180);
    }
  }, [open, tab]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    if (onSendChat(text)) setDraft('');
  };

  return (
    <aside className={cx('side-panel', open && 'is-open')} aria-label="对局记录与聊天">
      <div className="side-panel-head">
        <div className="side-tabs" role="tablist" aria-label="侧栏内容">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'log'}
            className={cx(tab === 'log' && 'is-active')}
            onClick={() => setTab('log')}
          >
            <Icon name="scroll" size={15} />
            对局记录
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'chat'}
            className={cx(tab === 'chat' && 'is-active')}
            onClick={() => setTab('chat')}
          >
            <Icon name="chat" size={15} />
            聊天
            {state.chat.length > 0 ? <span className="tab-count">{state.chat.length}</span> : null}
          </button>
        </div>
        <button type="button" className="icon-button side-close" onClick={onClose} aria-label="收起侧栏">
          <Icon name="close" size={18} />
        </button>
      </div>

      {tab === 'log' ? (
        <>
          <div className="side-feed log-feed">
            {state.logs.length === 0 ? (
              <div className="feed-empty">
                <Icon name="scroll" size={26} />
                <p>牌桌还很安静。</p>
                <span>洗牌、摸牌、搬动一张牌，都会记在这里。</span>
              </div>
            ) : (
              state.logs.map((entry) => (
                <div key={entry.id} className={cx('log-entry', `log-entry--${entry.tone}`)}>
                  <time>{formatTime(entry.at)}</time>
                  <p>{entry.text}</p>
                </div>
              ))
            )}
            <div ref={logEndRef} />
          </div>
          <div className="side-panel-footnote">
            <Icon name="scale" size={14} />
            所有操作只做同步，不校验牌序和玩法
          </div>
        </>
      ) : (
        <>
          <div className="side-feed chat-feed">
            {state.chat.length === 0 ? (
              <div className="feed-empty">
                <Icon name="chat" size={26} />
                <p>边打边聊。</p>
                <span>说一声“我摸两张”，比翻记录快。</span>
              </div>
            ) : (
              state.chat.map((message) => {
                const self = message.playerId === state.selfId;
                return (
                  <div key={message.id} className={cx('chat-message', self && 'is-self')}>
                    <span className="chat-avatar">{initialOf(message.playerName)}</span>
                    <div className="chat-bubble-wrap">
                      <div className="chat-meta">
                        <strong>{message.playerName}</strong>
                        <time>{formatTime(message.at)}</time>
                      </div>
                      <div className="chat-bubble">{message.text}</div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatEndRef} />
          </div>
          <form className="chat-composer" onSubmit={submit}>
            <input
              ref={chatInputRef}
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="说点什么…"
              maxLength={200}
              aria-label="聊天消息"
            />
            <button type="submit" className="chat-send" disabled={!draft.trim()} aria-label="发送">
              <Icon name="arrow-right" size={17} />
            </button>
          </form>
        </>
      )}
    </aside>
  );
}
