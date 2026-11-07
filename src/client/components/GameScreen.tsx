import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import type { CardView, ClientMessage, TableState, Team, ZoneRef } from '../../shared/types';
import { GENERAL_KEEP_COUNT } from '../../shared/types';
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
import { useTouchCardDrag } from '../useTouchCardDrag';
import { ConfirmDialog } from './ConfirmDialog';
import { GeneralDetailModal } from './GeneralDetailModal';
import { GeneralPickModal } from './GeneralPickModal';
import { DiscardPile, DeckPile, JudgmentZone } from './Piles';
import { Icon } from './Icons';
import { Modal } from './Modal';
import { SeatCard } from './SeatCard';
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
  const [discardOpen, setDiscardOpen] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [generalInfo, setGeneralInfo] = useState<CardView | null>(null);
  const [pickClosed, setPickClosed] = useState(false);
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

  const ownGeneralCount = self?.general.length ?? 0;
  useEffect(() => {
    if (ownGeneralCount <= GENERAL_KEEP_COUNT) setPickClosed(false);
  }, [ownGeneralCount]);

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

  const doCardDrop = (cardIds: string[], to: ZoneRef): boolean => {
    if (status !== 'online') {
      notify('连接尚未恢复，操作暂未发送', 'error');
      return false;
    }
    const locations = cardIds
      .map((id) => locateCard(state, id))
      .filter((item): item is NonNullable<typeof item> => Boolean(item));
    if (locations.length !== cardIds.length) {
      notify('有牌已经不在牌桌上了，请刷新后重试', 'error');
      return false;
    }
    // 弃牌区是开放式的：带位置放回弃牌区就是挪位置，不算「已经在目标区域」。
    const repositionInDiscard = to.kind === 'discard' && Boolean(to.position);
    if (!repositionInDiscard && locations.every((item) => sameZone(item.zone, to))) {
      notify('这些牌已经在目标区域了', 'info');
      return false;
    }
    const ok = sendMove(cardIds, to);
    if (ok) {
      setSelectedIds(new Set());
      dragIdsRef.current = [];
    }
    return ok;
  };

  const touchDrag = useTouchCardDrag({
    enabled: status === 'online',
    canDrag: (cardId) => currentVisible.has(cardId),
    getIds: (cardId) => (selectedIds.has(cardId) ? [...selectedIds] : [cardId]),
    onDrop: (_cardId, ids, to) => {
      doCardDrop(ids, to);
    },
  });

  if (!self) {
    return null;
  }

  const selectCard = (cardId: string) => {
    if (Date.now() < touchDrag.suppressClickUntilRef.current) return;
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
        notify('这张牌本来就在这个牌堆里', 'info');
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
    doCardDrop(ids, to);
  };

  const adjustHp = (playerId: string, delta: number) => {
    dispatchAction({ type: 'adjustHp', playerId, delta });
  };

  const setHp = (playerId: string, hp: number) => {
    dispatchAction({ type: 'setHp', playerId, hp });
  };

  const setTeam = (playerId: string, team: Team | null) => {
    dispatchAction({ type: 'setTeam', playerId, team });
  };

  const drawFromDeck = (deck: 'general' | 'normal') => {
    dispatchAction({
      type: 'moveTop',
      deck,
      to: { kind: 'player', playerId: self.id, zone: deck === 'general' ? 'general' : 'hand' },
    });
  };

  const revealGenerals = (cardIds: string[]) => {
    const ok = dispatchAction({ type: 'reveal', cardIds });
    if (ok) setSelectedIds(new Set());
  };

  const keepGenerals = (_keepIds: string[], returnIds: string[]) => {
    if (returnIds.length === 0) {
      setPickClosed(true);
      return;
    }
    const ok = sendMove(returnIds, { kind: 'deck', deck: 'general', placement: 'bottom' });
    if (ok) setPickClosed(true);
  };

  // 选中的牌全是自己武将区里还没展示的武将时，才提供「展示」。
  const revealableIds = [...selectedIds].filter((id) => {
    const location = locateCard(state, id);
    return (
      location &&
      location.zone.kind === 'player' &&
      location.zone.playerId === self.id &&
      location.zone.zone === 'general' &&
      location.card.category === 'general' &&
      !location.card.revealed
    );
  });
  const canReveal = selectedIds.size > 0 && revealableIds.length === selectedIds.size;
  const showPick = !pickClosed && self.general.length > GENERAL_KEEP_COUNT;

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

  const touchCard = touchDrag.active
    ? (locateCard(state, touchDrag.active.cardId)?.card ?? null)
    : null;

  const statusLabel =
    status === 'offline'
      ? '网络中断，正在尝试回到牌桌…'
      : status === 'connecting'
        ? '正在连接牌桌…'
        : '连接已恢复';

  return (
    <div className="game-screen">
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
              <div className="seat-row">
                {others.map((player) => (
                  <SeatCard
                    key={player.id}
                    player={player}
                    isSelf={false}
                    selectedIds={selectedIds}
                    onCardClick={selectCard}
                    onCardDragStart={handleCardDragStart}
                    onCardInfo={setGeneralInfo}
                    // 体力只能自己调：对手卡上不给加减按钮，服务端同样拦截。
                    onSetTeam={setTeam}
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
            {/* 开局已经给每人发过武将，牌局中不再需要武将牌堆；它仍在服务器上，选将放回的牌进那里。 */}
            <div className="core-piles core-piles--three">
              <JudgmentZone
                cards={state.judgment}
                selectedIds={selectedIds}
                onCardClick={selectCard}
                onCardDragStart={handleCardDragStart}
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
                牌堆牌面未知
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
              {selectedIds.size > 0 ? (
                <div className="rail-selection" role="region" aria-label="已选牌操作">
                  <span className="rail-selection-count">{selectedCards.length}</span>
                  <span className="rail-selection-text" title={selectedSummary}>
                    {selectedSummary || '已选牌'}
                    <small>
                      {selectedCurrentZone ? `来自${zoneName(state, selectedCurrentZone)}` : '来自多个区域'}
                    </small>
                  </span>
                  {canReveal ? (
                    <button
                      type="button"
                      className="rail-button rail-button--accent"
                      onClick={() => revealGenerals(revealableIds)}
                      title="展示后所有人都能看到这张武将，不可收回"
                    >
                      <Icon name="eye" size={12} />
                      展示
                    </button>
                  ) : null}
                  <button type="button" className="rail-button" onClick={() => setSelectedIds(new Set())}>
                    取消
                  </button>
                </div>
              ) : (
                <span>
                  <Icon name="hand" size={12} />
                  <span className="desktop-hint">手牌只有你能看见 · 武将默认只对自己展示</span>
                  <span className="touch-hint">长按卡牌拖动 · 轻点多选</span>
                </span>
              )}
            </div>
            <SeatCard
              player={self}
              isSelf
              selectedIds={selectedIds}
              onCardClick={selectCard}
              onCardDragStart={handleCardDragStart}
              onCardInfo={setGeneralInfo}
              onReveal={(cardId) => revealGenerals([cardId])}
              onAdjustHp={adjustHp}
              onSetHp={setHp}
              onSetTeam={setTeam}
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

      {showPick ? (
        <GeneralPickModal
          generals={self.general.filter((card) => card.category === 'general' && !card.hidden)}
          onKeep={keepGenerals}
          onInfo={setGeneralInfo}
          onClose={() => setPickClosed(true)}
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

      {generalInfo
        ? (() => {
            // 放大看武将时，顺手提供「展示」；只对自己武将区里未展示的武将给操作。
            const location = locateCard(state, generalInfo.id);
            const inGeneralZone =
              location && location.zone.kind === 'player' && location.zone.zone === 'general';
            const own = inGeneralZone && location.zone.kind === 'player' && location.zone.playerId === self.id;
            const liveCard = location?.card ?? generalInfo;
            const actions = inGeneralZone ? (
              <>
                {own && !liveCard.revealed ? (
                  <button
                    type="button"
                    className="rail-button rail-button--accent"
                    onClick={() => {
                      revealGenerals([liveCard.id]);
                      setGeneralInfo(null);
                    }}
                    title="展示后所有人都能看到这张武将，不可收回"
                  >
                    <Icon name="eye" size={12} />
                    展示给全桌
                  </button>
                ) : null}
              </>
            ) : null;
            return <GeneralDetailModal card={liveCard} onClose={() => setGeneralInfo(null)} actions={actions} />;
          })()
        : null}

      {touchDrag.active && touchCard ? (
        <div
          className="touch-drag-ghost"
          style={{ left: touchDrag.active.x, top: touchDrag.active.y }}
          aria-hidden="true"
        >
          <PlayingCard card={touchCard} size="md" />
          {touchDrag.active.ids.length > 1 ? (
            <span className="touch-drag-count">{touchDrag.active.ids.length}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
