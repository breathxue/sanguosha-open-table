import { useState, type DragEvent, type ReactNode } from 'react';
import type { ZoneRef } from '../../shared/types';
import { cx } from '../utils';
import { hasDragPayload, readDragPayload, type DragPayload } from '../dnd';

interface DropZoneProps {
  zone: ZoneRef;
  onDrop: (payload: DragPayload, to: ZoneRef) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function DropZone({ zone, onDrop, children, className, disabled = false }: DropZoneProps) {
  const [isOver, setIsOver] = useState(false);

  const accept = (event: DragEvent<HTMLDivElement>) => {
    if (disabled || !hasDragPayload(event)) return false;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    return true;
  };

  return (
    <div
      className={cx('drop-zone', isOver && 'is-drop-over', className)}
      data-drop-zone={JSON.stringify(zone)}
      onDragEnter={(event) => {
        if (accept(event)) setIsOver(true);
      }}
      onDragOver={(event) => {
        if (accept(event) && !isOver) setIsOver(true);
      }}
      onDragLeave={(event) => {
        const next = event.relatedTarget;
        if (!(next instanceof Node) || !event.currentTarget.contains(next)) {
          setIsOver(false);
        }
      }}
      onDrop={(event) => {
        if (disabled) return;
        event.preventDefault();
        event.stopPropagation();
        setIsOver(false);
        const payload = readDragPayload(event);
        if (payload) onDrop(payload, zone);
      }}
    >
      {children}
    </div>
  );
}
