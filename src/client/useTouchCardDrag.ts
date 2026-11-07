import { useEffect, useRef, useState, type MutableRefObject } from 'react';
import type { ZoneRef } from '../shared/types';
import { zoneAtPoint } from './dnd';

export interface TouchDragActive {
  cardId: string;
  ids: string[];
  x: number;
  y: number;
}

interface TouchDragOptions {
  enabled: boolean;
  canDrag: (cardId: string) => boolean;
  getIds: (cardId: string) => string[];
  onDrop: (cardId: string, ids: string[], to: ZoneRef) => void;
}

interface TouchDragApi {
  active: TouchDragActive | null;
  suppressClickUntilRef: MutableRefObject<number>;
}

const LONG_PRESS_MS = 280;
const MOVE_TOLERANCE = 10;

function zoneElementAt(x: number, y: number): HTMLElement | null {
  const element = document.elementFromPoint(x, y);
  if (!(element instanceof Element)) return null;
  return element.closest<HTMLElement>('[data-drop-zone]');
}

function zoneFromElement(element: HTMLElement | null, x?: number, y?: number): ZoneRef | null {
  const raw = element?.getAttribute('data-drop-zone');
  if (!raw || !element) return null;
  try {
    const zone = JSON.parse(raw) as ZoneRef;
    return x === undefined || y === undefined ? zone : zoneAtPoint(zone, element, x, y);
  } catch {
    return null;
  }
}

/**
 * Long-press drag for touch screens. Native HTML5 drag events do not fire on
 * mobile browsers. A short hold lifts the card, then the finger can drag it to
 * any drop zone. Quick taps still go through the normal click selection path.
 */
export function useTouchCardDrag(options: TouchDragOptions): TouchDragApi {
  const [active, setActive] = useState<TouchDragActive | null>(null);
  const activeRef = useRef<TouchDragActive | null>(null);
  const suppressClickUntilRef = useRef(0);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    let pending: {
      cardId: string;
      ids: string[];
      startX: number;
      startY: number;
      lastX: number;
      lastY: number;
      sourceZone: string | null;
      timer: number | null;
    } | null = null;
    let dragging = false;
    let hoverElement: HTMLElement | null = null;
    let hoverOverlay: HTMLDivElement | null = null;

    const clearHover = () => {
      hoverOverlay?.remove();
      hoverOverlay = null;
      hoverElement = null;
    };

    const positionOverlay = (element: HTMLElement) => {
      if (!hoverOverlay) {
        hoverOverlay = document.createElement('div');
        hoverOverlay.className = 'touch-drop-overlay';
        const label = document.createElement('span');
        label.textContent = '放到这里';
        hoverOverlay.appendChild(label);
        document.body.appendChild(hoverOverlay);
      }
      const rect = element.getBoundingClientRect();
      hoverOverlay.style.left = `${rect.left}px`;
      hoverOverlay.style.top = `${rect.top}px`;
      hoverOverlay.style.width = `${rect.width}px`;
      hoverOverlay.style.height = `${rect.height}px`;
    };

    const updateHover = (x: number, y: number) => {
      const next = zoneElementAt(x, y);
      if (next === hoverElement) {
        if (next) positionOverlay(next);
        return;
      }
      hoverElement = next;
      if (!next) {
        hoverOverlay?.remove();
        hoverOverlay = null;
        return;
      }
      positionOverlay(next);
    };

    const cancelPending = () => {
      if (pending?.timer) window.clearTimeout(pending.timer);
      pending = null;
    };

    const onTouchStart = (event: TouchEvent) => {
      if (!optionsRef.current.enabled || dragging || pending) return;
      if (event.touches.length !== 1) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('.modal, .side-panel, button, input, textarea, select')) return;
      const cardElement = target.closest<HTMLElement>('[data-card-id]');
      const cardId = cardElement?.dataset.cardId;
      if (!cardElement || !cardId || !optionsRef.current.canDrag(cardId)) return;

      const touch = event.touches[0];
      const sourceZone = cardElement.closest<HTMLElement>('[data-drop-zone]');
      pending = {
        cardId,
        ids: optionsRef.current.getIds(cardId),
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY,
        sourceZone: sourceZone?.getAttribute('data-drop-zone') ?? null,
        timer: null,
      };

      pending.timer = window.setTimeout(() => {
        if (!pending) return;
        const current = pending;
        pending = null;
        dragging = true;
        const next = {
          cardId: current.cardId,
          ids: current.ids,
          x: current.lastX,
          y: current.lastY,
        };
        activeRef.current = next;
        setActive(next);
        navigator.vibrate?.(10);
      }, LONG_PRESS_MS);
    };

    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;

      if (dragging) {
        event.preventDefault();
        if (activeRef.current) {
          activeRef.current = { ...activeRef.current, x: touch.clientX, y: touch.clientY };
          setActive(activeRef.current);
        }
        updateHover(touch.clientX, touch.clientY);
        return;
      }

      if (!pending) return;
      pending.lastX = touch.clientX;
      pending.lastY = touch.clientY;
      const distance = Math.hypot(
        touch.clientX - pending.startX,
        touch.clientY - pending.startY,
      );
      if (distance > MOVE_TOLERANCE) {
        cancelPending();
      }
    };

    const finishDrag = (event: TouchEvent, cancelled: boolean) => {
      if (!dragging) {
        cancelPending();
        return;
      }

      event.preventDefault();
      const touch = event.changedTouches[0];
      const targetElement = touch ? zoneElementAt(touch.clientX, touch.clientY) : null;
      const to = touch ? zoneFromElement(targetElement, touch.clientX, touch.clientY) : null;
      const activeCard = activeRef.current;
      clearHover();
      dragging = false;
      activeRef.current = null;
      setActive(null);
      suppressClickUntilRef.current = Date.now() + 500;

      if (!cancelled && to && activeCard) {
        optionsRef.current.onDrop(activeCard.cardId, activeCard.ids, to);
      }
    };

    const onTouchEnd = (event: TouchEvent) => finishDrag(event, false);
    const onTouchCancel = (event: TouchEvent) => finishDrag(event, true);

    const onContextMenu = (event: MouseEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-card-id]')) {
        event.preventDefault();
      }
    };

    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: false });
    document.addEventListener('touchcancel', onTouchCancel, { passive: true });
    document.addEventListener('contextmenu', onContextMenu);

    return () => {
      cancelPending();
      clearHover();
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchCancel);
      document.removeEventListener('contextmenu', onContextMenu);
    };
  }, []);

  return { active, suppressClickUntilRef };
}
