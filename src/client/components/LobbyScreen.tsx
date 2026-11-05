import { useState } from 'react';
import type { ClientMessage, TableState } from '../../shared/types';
import type { ConnectionStatus } from '../useRoomSocket';
import type { ToastTone } from '../types';
import { copyText, formatTime, initialOf, inviteUrl } from '../utils';
import { ConfirmDialog } from './ConfirmDialog';
import { Icon } from './Icons';
import { TopBar } from './TopBar';

interface LobbyScreenProps {
  state: TableState;
  status: ConnectionStatus;
  send: (message: ClientMessage) => boolean;
  onLeave: () => void;
  notify: (message: string, tone?: ToastTone) => void;
}

export function LobbyScreen({ state, status, send, onLeave, notify }: LobbyScreenProps) {
  const [confirmLeave, setConfirmLeave] = useState(false);

  const copyInvite = async () => {
    const ok = await copyText(inviteUrl(state.code));
    notify(ok ? '邀请链接已复制，发给朋友吧' : '复制失败，请手动复制地址栏链接', ok ? 'success' : 'error');
  };

  const copyCode = async () => {
    const ok = await copyText(state.code);
    notify(ok ? `房间号 ${state.code} 已复制` : '复制失败，请手动输入房间号', ok ? 'success' : 'error');
  };

  const start = () => {
    if (status !== 'online') {
      notify('网络尚未恢复，请稍后再试', 'error');
      return;
    }
    if (!send({ type: 'start' })) return;
  };

  const playersBySeat = new Map(state.players.map((player) => [player.seat, player]));
  const seats = Array.from({ length: state.maxPlayers }, (_, index) => ({
    seat: index,
    player: playersBySeat.get(index) ?? null,
  }));
  const recentLogs = state.logs.slice(-3).reverse();

  return (
    <div className="lobby-screen">
      <div className="lobby-glow" aria-hidden="true" />
      <TopBar
        state={state}
        status={status}
        onCopyInvite={copyInvite}
        onLeave={() => setConfirmLeave(true)}
      />

      <main className="lobby-main">
        <section className="lobby-invite">
          <span className="eyebrow">
            <span className="eyebrow-line" />
            牌桌已铺好
          </span>
          <h1>
            招呼朋友
            <br />
            <span>入席</span>
          </h1>
          <p className="lobby-lead">
            把房间号或邀请链接发给他们。这里没有满员限制，也没有规则裁判——
            你们到齐，随时开桌。
          </p>

          <div className="lobby-code-card">
            <div className="lobby-code-head">
              <span>房间号</span>
              <button type="button" className="mini-text-button" onClick={copyCode}>
                <Icon name="copy" size={13} />
                复制
              </button>
            </div>
            <div className="lobby-code">{state.code}</div>
            <button type="button" className="primary-button lobby-copy-button" onClick={copyInvite}>
              <Icon name="link" size={17} />
              复制邀请链接
            </button>
            <p className="lobby-code-hint">朋友打开链接后，输入称呼即可入座。</p>
          </div>

          <div className="lobby-flow">
            <div>
              <span className="flow-index">01</span>
              <p>创建牌桌，把链接发给朋友</p>
            </div>
            <div>
              <span className="flow-index">02</span>
              <p>人齐后任意玩家都可以开始</p>
            </div>
            <div>
              <span className="flow-index">03</span>
              <p>双牌堆、任意搬运，规则由你们定</p>
            </div>
          </div>
        </section>

        <section className="lobby-seats-panel">
          <div className="seats-head">
            <div>
              <span className="panel-kicker">SEATS</span>
              <h2>在座 {state.players.length} / {state.maxPlayers}</h2>
            </div>
            <span className="seats-hint">空位可以随时加入</span>
          </div>

          <div className="seat-grid">
            {seats.map(({ seat, player }) =>
              player ? (
                <article
                  key={player.id}
                  className={`seat-tile seat-tile--filled ${
                    player.id === state.selfId ? 'is-self' : ''
                  } ${!player.connected ? 'is-offline' : ''}`}
                >
                  <span className="seat-number">座位 {seat + 1}</span>
                  <span className="seat-avatar">{initialOf(player.name)}</span>
                  <div className="seat-info">
                    <strong>{player.name}</strong>
                    <span>
                      {player.id === state.selfId ? '你' : player.connected ? '已入席' : '暂时离线'}
                    </span>
                  </div>
                  {player.isHost ? (
                    <span className="seat-host" title="房主">
                      <Icon name="crown" size={13} />
                      房主
                    </span>
                  ) : (
                    <span className={`seat-connection ${player.connected ? 'is-on' : ''}`} />
                  )}
                </article>
              ) : (
                <div key={`empty-${seat}`} className="seat-tile seat-tile--empty">
                  <span className="seat-number">座位 {seat + 1}</span>
                  <span className="seat-empty-mark">+</span>
                  <span>等待入席</span>
                </div>
              ),
            )}
          </div>

          <div className="lobby-activity">
            <div className="activity-head">
              <span>
                <Icon name="scroll" size={14} />
                最近动静
              </span>
              <span className="activity-live">
                <i />
                实时同步
              </span>
            </div>
            {recentLogs.length === 0 ? (
              <p className="activity-empty">牌桌安静得很。有人入席后会出现在这里。</p>
            ) : (
              <ul>
                {recentLogs.map((entry) => (
                  <li key={entry.id}>
                    <time>{formatTime(entry.at)}</time>
                    <span>{entry.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="lobby-start">
            <div className="lobby-start-copy">
              <strong>{state.players.length < 2 ? '也可以先开桌试试' : '人齐了，开桌吧'}</strong>
              <span>任意玩家都可以开始，不需要等人满。</span>
            </div>
            <button
              type="button"
              className="primary-button start-button"
              onClick={start}
              disabled={status !== 'online'}
            >
              开始牌局
              <Icon name="arrow-right" size={18} />
            </button>
          </div>
        </section>
      </main>

      <footer className="lobby-footer">
        <span>
          <Icon name="scale" size={14} /> 牌桌不检查规则，只同步操作
        </span>
        <span>邀请链接仅在本服务器内有效</span>
      </footer>

      {confirmLeave ? (
        <ConfirmDialog
          title="离开这张牌桌？"
          description="你的座位会被释放。如果牌局已经开始，座位上的牌会进入弃牌区。"
          confirmLabel="离开牌桌"
          onConfirm={onLeave}
          onCancel={() => setConfirmLeave(false)}
          danger
        />
      ) : null}
    </div>
  );
}
