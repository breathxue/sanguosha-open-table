import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import type { ClientMessage, TableState, ZoneRef } from '../../shared/types';
import { cx } from '../utils';
import { copyText, inviteUrl } from '../utils';
import type { ConnectionStatus } from '../useRoomSocket';
import type { ToastTone } from '../types';
import {
  cardsForIds,
  locateCard,
  sameZone,
  visibleCardIds,
  zoneName,
} from '../gameState';
import { writeDragPayload, type DragPayload } from '../dnd';
import { ConfirmDialog } from './ConfirmDialog';
import { DiscardPile, DeckPile } from './Piles';
import { Icon } from './Icons';
import { Modal } from './Modal';
import { MoveDialog, type MoveSource } from './MoveDialog';
import { PlayerBoard } from './PlayerBoard';
import { PlayingCard } from './PlayingCard';
import { SidePanel } from './SidePanel';
import { TopBar } from './TopBar';

interface GameScreenProps {
  state: TableState;
  status: ConnectionStatus;
  send: (message: ClientMessage) => boolean;
  onLeave: () => void;
  notify: (message: string, tone?: ToastTone) => void;
}

export function GameScreen({ state, status, send, onLeave, notify }: GameScreenProps) {
  const self = state.players.find((player) => player.id === state.selfId);
  const others = state.players.filter((player) => player.id !== state.selfId);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [moveSource, setMoveSource] = useState<MoveSource | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const dragIdsRef = useRef<string[]>([]);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const currentVisible = useMemo(() => visibleCardIds(state), [state]);
  const selectedCards = cardsForIds(state, [...selectedIds]);
  const selectedLocations = [...selectedIds]
    .map((id) => locateCard(state, id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));
  const selectedFirstZone = selectedLocations[0]?.zone ?? null;
  const selectedCurrentZone =
    selectedFirstZone && selectedLocations.every((item) => sameZone(item.zone, selectedFirstZone))
      ? selectedFirstZone
      : null;

  useEffect(() => {
    if (tableScrollRef.current) tableScrollRef.current.scrollTop = 0;
  }, [state.code]);

  useEffect(() => {
    setSelectedIds((previous) => {
      const next = new Set([...previous].filter((id) => currentVisible.has(id)));
      return next.size === previous.size ? previous : next;
    });
  }, [currentVisible]);

  if (!self) {
    return null;
  }

  const dispatchAction = (action: Extract<ClientMessage, { type: 'action' }>['action']): boolean => {
    if (status !== 'online') {
      notify('连接尚未恢复，操作暂未发送', 'error');
      return false;
    }
    return send({ type: 'action', action });
  };

  const sendMove = (cardIds: string[], to: ZoneRef): boolean => {
    return dispatchAction({ type: 'move', cardIds, to });
  };

  const selectCard = (cardId: string) => {
    if (!currentVisible.has(cardId)) return;
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(cardId)) next.delete(cardId);
      else next.add(cardId);
      return next;
    });
  };

  const handleCardDragStart = (cardId: string, event: DragEvent<HTMLDivElement>) => {
    if (status !== 'online') {
      event.preventDefault();
      notify('连接尚未恢复，暂时不能移动牌', 'error');
      return;
    }
    const ids = selectedIds.has(cardId) ? [...selectedIds] : [cardId];
    if (!selectedIds.has(cardId)) setSelectedIds(new Set([cardId]));
    dragIdsRef.current = ids;
    writeDragPayload(event, { kind: 'card', cardId });
  };

  const handleDrop = (payload: DragPayload, to: ZoneRef) => {
    if (status !== 'online') {
      notify('连接尚未恢复，操作暂未发送', 'error');
      return;
    }

    if (payload.kind === 'deck') {
      if (to.kind === 'deck' && to.deck === payload.deck) {
        notify('牌堆顶已经在这里了', 'info');
        return;
      }
      const ok = dispatchAction({ type: 'moveTop', deck: payload.deck, to });
      if (ok) setSelectedIds(new Set());
      return;
    }

    const ids =
      dragIdsRef.current.includes(payload.cardId) && dragIdsRef.current.length > 0
        ? dragIdsRef.current
        : [payload.cardId];
    const locations = ids
      .map((id) => locateCard(state, id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (
      locations.length === ids.length &&
      locations.every((item) => sameZone(item.zone, to))
    ) {
      notify('这些牌已经在目标区域了', 'info');
      return;
    }
    const ok = sendMove(ids, to);
    if (ok) {
      setSelectedIds(new Set());
      dragIdsRef.current = [];
    }
  };

  const drawFromDeck = (deck: 'general' | 'normal') => {
    dispatchAction({
      type: 'moveTop',
      deck,
      to: { kind: 'player', playerId: self.id, zone: 'hand' },
    });
  };

  const shuffleDeck = (deck: 'general' | 'normal') => {
    dispatchAction({ type: 'shuffle', deck });
  };

  const chooseDestination = (to: ZoneRef) => {
    if (!moveSource) return;
    let ok = false;
    if (moveSource.kind === 'deck') {
      ok = dispatchAction({ type: 'moveTop', deck: moveSource.deck, to });
    } else {
      ok = sendMove(moveSource.cardIds, to);
    }
    if (ok) {
      setMoveSource(null);
      setSelectedIds(new Set());
    }
  };

  const copyInvite = async () => {
    const ok = await copyText(inviteUrl(state.code));
    notify(ok ? '邀请链接已复制' : '复制失败，请手动复制地址栏链接', ok ? 'success' : 'error');
  };

  const sendChat = (text: string): boolean => {
    if (status !== 'online') {
      notify('连接尚未恢复，消息未发送', 'error');
      return false;
    }
    return send({ type: 'chat', text });
  };

  const leaveNow = () => {
    onLeave();
  };

  const selectedSummary = (() => {
    if (selectedCards.length === 0) return '';
    const names = selectedCards.map((card) => `【${card.name}】`);
    if (names.length <= 3) return names.join('、');
    return `${names.slice(0, 3).join('、')} 等 ${names.length} 张`;
  })();

  const statusLabel =
    status === 'offline'
      ? '网络中断，正在尝试回到牌桌…'
      : status === 'connecting'
        ? '正在连接牌桌…'
        : '连接已恢复';

  return (
    <div className={cx('game-screen', selectedIds.size > 0 && 'has-selection')}>
      <TopBar
        state={state}
        status={status}
        onCopyInvite={copyInvite}
        onLeave={() => setConfirmLeave(true)}
        onToggleChat={() => setSidebarOpen((open) => !open)}
        chatOpen={sidebarOpen}
      />

      {status !== 'online' ? (
        <div className={cx('connection-banner', `connection-banner--${status}`)}>
          <span className="connection-banner-spinner" />
          {statusLabel}
          <span className="connection-banner-hint">已选中的牌不会丢失</span>
        </div>
      ) : null}

      <div className="game-layout">
        <main className="table-stage">
          <div className="table-scroll" ref={tableScrollRef}>
          <section className="opponents-section" aria-label="其他玩家">
            <div className="stage-section-head">
              <div>
                <span className="panel-kicker">TABLE</span>
                <h2>牌桌上的其他人</h2>
              </div>
              <span className="stage-hint">
                <Icon name="eye" size={13} />
                他人手牌不可见
              </span>
            </div>
            {others.length === 0 ? (
              <div className="solo-notice">
                <span className="solo-mark">+</span>
                <div>
                  <strong>还没有其他玩家</strong>
                  <p>把邀请链接发给朋友，他们随时可以入座。你也可以先熟悉一下牌桌。</p>
                </div>
                <button type="button" className="ghost-button" onClick={copyInvite}>
                  <Icon name="link" size={15} />
                  复制邀请
                </button>
              </div>
            ) : (
              <div className={cx('opponents-grid', others.length === 1 && 'is-single')}>
                {others.map((player) => (
                  <PlayerBoard
                    key={player.id}
                    player={player}
                    isSelf={false}
                    selectedIds={selectedIds}
                    onCardClick={selectCard}
                    onCardDragStart={handleCardDragStart}
                    onDrop={handleDrop}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="table-core" aria-label="公共牌区">
            <span className="table-core-mark" aria-hidden="true">
              自由牌桌
            </span>
            <div className="core-head">
              <div>
                <span className="panel-kicker">SHARED AREA</span>
                <h2>公共牌区</h2>
              </div>
              <span className="core-hint">
                <Icon name="move" size={13} />
                拖拽任意牌到任意区域
              </span>
            </div>
            <div className="core-piles">
              <DeckPile
                deck="general"
                count={state.deckCounts.general}
                disabled={status !== 'online'}
                onDraw={() => drawFromDeck('general')}
                onMoveTop={() => setMoveSource({ kind: 'deck', deck: 'general' })}
                onShuffle={() => shuffleDeck('general')}
                onDrop={handleDrop}
              />
              <DiscardPile
                cards={state.discard}
                selectedIds={selectedIds}
                onCardClick={selectCard}
                onCardDragStart={handleCardDragStart}
                onOpen={() => setDiscardOpen(true)}
                onDrop={handleDrop}
              />
              <DeckPile
                deck="normal"
                count={state.deckCounts.normal}
                disabled={status !== 'online'}
                onDraw={() => drawFromDeck('normal')}
                onMoveTop={() => setMoveSource({ kind: 'deck', deck: 'normal' })}
                onShuffle={() => shuffleDeck('normal')}
                onDrop={handleDrop}
              />
            </div>
            <div className="core-foot">
              <span>
                <i className="legend-dot legend-dot--red" />
                点击卡牌可多选
              </span>
              <span>
                <i className="legend-dot legend-dot--gold" />
                牌堆顶未知
              </span>
              <span>
                <i className="legend-dot legend-dot--green" />
                手牌仅本人可见
              </span>
            </div>
          </section>
          </div>

          <section className="self-section" aria-label="你的座位">
            <div className="self-rail">
              <span>
                <i>YOUR SEAT</i>
                你的座位
              </span>
              <span>
                <Icon name="hand" size={12} />
                手牌只有你能看见
              </span>
            </div>
            <PlayerBoard
              player={self}
              isSelf
              selectedIds={selectedIds}
              onCardClick={selectCard}
              onCardDragStart={handleCardDragStart}
              onDrop={handleDrop}
            />
          </section>
        </main>

        <SidePanel
          state={state}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onSendChat={sendChat}
        />
      </div>

      {sidebarOpen ? (
        <button
          type="button"
          className="side-scrim"
          onClick={() => setSidebarOpen(false)}
          aria-label="关闭侧栏"
        />
      ) : null}

      {selectedIds.size > 0 ? (
        <div className="selection-dock" role="region" aria-label="已选牌操作">
          <div className="selection-summary">
            <span className="selection-count">{selectedCards.length}</span>
            <div>
              <strong>{selectedSummary || '已选牌'}</strong>
              <span>
                {selectedCurrentZone
                  ? `来自${zoneName(state, selectedCurrentZone)}`
                  : '来自多个区域'}
              </span>
            </div>
          </div>
          <div className="selection-actions">
            <button
              type="button"
              className="primary-button selection-move"
              onClick={() => setMoveSource({ kind: 'cards', cardIds: [...selectedIds] })}
            >
              <Icon name="move" size={16} />
              移动至…
            </button>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setSelectedIds(new Set())}
            >
              取消
            </button>
          </div>
        </div>
      ) : null}

      {moveSource ? (
        <MoveDialog
          state={state}
          source={moveSource}
          onClose={() => setMoveSource(null)}
          onChoose={chooseDestination}
        />
      ) : null}

      {discardOpen ? (
        <Modal
          title="弃牌堆"
          subtitle={`${state.discard.length} 张牌 · 点击卡牌可选中，可多选`}
          onClose={() => setDiscardOpen(false)}
          size="lg"
          className="pile-modal"
          footer={
            <>
              <span className="pile-modal-count">已选 {selectedCards.length} 张</span>
              <button type="button" className="primary-button" onClick={() => setDiscardOpen(false)}>
                完成选择
              </button>
            </>
          }
        >
          {state.discard.length === 0 ? (
            <div className="pile-empty">
              <Icon name="scroll" size={30} />
              <p>弃牌区还是空的</p>
            </div>
          ) : (
            <div className="pile-grid">
              {state.discard.map((card) => (
                <PlayingCard
                  key={card.id}
                  card={card}
                  size="sm"
                  selected={selectedIds.has(card.id)}
                  onClick={() => selectCard(card.id)}
                  onDragStart={(event) => handleCardDragStart(card.id, event)}
                />
              ))}
            </div>
          )}
        </Modal>
      ) : null}

      {confirmLeave ? (
        <ConfirmDialog
          title="离开牌桌？"
          description="座位会被释放。牌局已经开始的话，你区域内的牌会进入弃牌区。"
          confirmLabel="离开牌桌"
          onConfirm={leaveNow}
          onCancel={() => setConfirmLeave(false)}
          danger
        />
      ) : null}
    </div>
  );
}
