import type { DragEvent } from 'react';

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
