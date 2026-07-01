import { useCallback, useRef, useState } from 'react';

const MOVE_CANCEL_PX = 10;

function isNoDragTarget(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(
    '[data-no-drag], a[href], input, select, textarea, [contenteditable="true"]'
  );
}

/**
 * Pointer-events drag-to-reorder for dashboard panels. Unlike HTML5 drag-and-drop
 * (which has no native touch support), pointer events unify mouse + touch + pen.
 * Drag is armed by a short hold on the panel surface (not on buttons/inputs);
 * movement before the hold completes cancels so scrolling still works. While
 * dragging it hit-tests the panel under the pointer (throttled) to swap order,
 * and auto-scrolls near screen edges.
 */
export function useDraggablePanels(order: string[], onReorder: (next: string[]) => void) {
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSwap = useRef(0);
  const orderRef = useRef(order);
  const pendingKey = useRef<string | null>(null);
  const startPos = useRef<{ x: number; y: number } | null>(null);
  const wasDragged = useRef(false);
  orderRef.current = order;

  const stopScroll = () => {
    if (scrollTimer.current) { clearInterval(scrollTimer.current); scrollTimer.current = null; }
  };

  const cancelArm = () => {
    if (armTimer.current) { clearTimeout(armTimer.current); armTimer.current = null; }
    pendingKey.current = null;
    startPos.current = null;
  };

  const handlePointerDown = useCallback((key: string) => (e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return;
    if (isNoDragTarget(e.target)) return;

    const el = e.currentTarget as HTMLElement;
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    pendingKey.current = key;
    startPos.current = { x: e.clientX, y: e.clientY };
    const delay = e.pointerType === 'touch' ? 380 : 150;
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => {
      if (pendingKey.current === key) setDraggedKey(key);
    }, delay);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggedKey && pendingKey.current && startPos.current) {
      const dx = e.clientX - startPos.current.x;
      const dy = e.clientY - startPos.current.y;
      if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) {
        cancelArm();
        return;
      }
    }

    if (!draggedKey) return;
    e.preventDefault();

    const edge = 110;
    const dir = e.clientY < edge ? -1 : e.clientY > window.innerHeight - edge ? 1 : 0;
    if (dir !== 0 && !scrollTimer.current) {
      scrollTimer.current = setInterval(() => window.scrollBy(0, dir * 14), 16);
    } else if (dir === 0) {
      stopScroll();
    }

    const now = Date.now();
    if (now - lastSwap.current < 200) return;
    const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const overKey = target?.closest('[data-panel-key]')?.getAttribute('data-panel-key');
    if (overKey && overKey !== draggedKey) {
      const cur = orderRef.current;
      const from = cur.indexOf(draggedKey);
      const to = cur.indexOf(overKey);
      if (from !== -1 && to !== -1) {
        const next = [...cur];
        next.splice(from, 1);
        next.splice(to, 0, draggedKey);
        lastSwap.current = now;
        onReorder(next);
      }
    }
  }, [draggedKey, onReorder]);

  const endDrag = useCallback(() => {
    if (draggedKey) wasDragged.current = true;
    cancelArm();
    stopScroll();
    setDraggedKey(null);
  }, [draggedKey]);

  const consumeWasDragged = useCallback(() => {
    const v = wasDragged.current;
    wasDragged.current = false;
    return v;
  }, []);

  return { draggedKey, handlePointerDown, handlePointerMove, endDrag, consumeWasDragged };
}
