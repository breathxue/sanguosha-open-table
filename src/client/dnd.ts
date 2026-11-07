import type { DragEvent } from 'react';
import type { ZoneRef } from '../shared/types';

export const DRAG_MIME = 'application/x-sanguosha-table+json';

export type DragPayload =
  | { kind: 'card'; cardId: string }
  | { kind: 'deck'; deck: 'general' | 'normal' };

export function writeDragPayload(
  event: DragEvent<HTMLElement>,
  payload: DragPayload,
): void {
  const serialized = JSON.stringify(payload);
  event.dataTransfer.setData(DRAG_MIME, serialized);
  event.dataTransfer.setData('text/plain', serialized);
  event.dataTransfer.effectAllowed = 'move';
}

export function readDragPayload(event: DragEvent<HTMLElement>): DragPayload | null {
  const raw = event.dataTransfer.getData(DRAG_MIME) || event.dataTransfer.getData('text/plain');
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<DragPayload>;
    if (value.kind === 'card' && typeof value.cardId === 'string') {
      return { kind: 'card', cardId: value.cardId };
    }
    if (value.kind === 'deck' && (value.deck === 'general' || value.deck === 'normal')) {
      return { kind: 'deck', deck: value.deck };
    }
  } catch {
    return null;
  }
  return null;
}

export function hasDragPayload(event: DragEvent<HTMLElement>): boolean {
  const types = Array.from(event.dataTransfer.types);
  return types.includes(DRAG_MIME) || types.includes('text/plain');
}

/**
 * 投放时把指针位置折算成区域内的相对坐标。只有开放式弃牌区需要位置，
 * 其他区域原样返回。
 */
export function zoneAtPoint(zone: ZoneRef, element: Element, clientX: number, clientY: number): ZoneRef {
  if (zone.kind !== 'discard') return zone;
  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return zone;
  const x = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
  const y = Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
  return { kind: 'discard', position: { x, y } };
}
