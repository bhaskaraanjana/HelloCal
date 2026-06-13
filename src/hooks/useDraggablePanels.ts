import { useCallback, useRef, useState } from 'react';

/**
 * Pointer-events drag-to-reorder for dashboard panels. Unlike HTML5 drag-and-drop
 * (which has no native touch support), pointer events unify mouse + touch + pen,
 * so this works on phones. Drag is armed by a long-press on a dedicated handle
 * (so normal taps/scrolls aren't hijacked); while dragging it hit-tests the panel
 * under the pointer (throttled) to swap order, and auto-scrolls near screen edges.
 */
export function useDraggablePanels(order: string[], onReorder: (next: string[]) => void) {
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSwap = useRef(0);
  const orderRef = useRef(order);
  orderRef.current = order;

  const stopScroll = () => {
    if (scrollTimer.current) { clearInterval(scrollTimer.current); scrollTimer.current = null; }
  };

  const handlePointerDown = useCallback((key: string) => (e: React.PointerEvent) => {
    if (e.button != null && e.button !== 0) return; // left/primary only
    const el = e.currentTarget as HTMLElement;
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const delay = e.pointerType === 'touch' ? 320 : 120;
    if (armTimer.current) clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setDraggedKey(key), delay);
  }, []);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggedKey) return;
    e.preventDefault();

    // Auto-scroll when near the top/bottom edge so long pages reorder on mobile.
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
    if (armTimer.current) { clearTimeout(armTimer.current); armTimer.current = null; }
    stopScroll();
    setDraggedKey(null);
  }, []);

  return { draggedKey, handlePointerDown, handlePointerMove, endDrag };
}
