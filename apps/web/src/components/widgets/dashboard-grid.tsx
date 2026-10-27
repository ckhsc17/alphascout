"use client";

import { type ReactNode, useCallback, useRef, useState, useTransition } from "react";
import ReactGridLayout, { type Layout, useContainerWidth } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

export interface GridItem {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  node: ReactNode;
}

const ROW_HEIGHT = 40;
const MOBILE_BREAKPOINT = 768;

/**
 * Dashboard grid. Owners can drag (by the widget header) and resize; changes are saved after
 * each gesture. Below the mobile breakpoint widgets simply stack.
 */
export function DashboardGrid({
  items,
  editable,
  onSaveLayout,
}: {
  items: GridItem[];
  editable: boolean;
  onSaveLayout?: (
    layout: { id: string; x: number; y: number; w: number; h: number }[],
  ) => Promise<void>;
}) {
  const { width, containerRef, mounted } = useContainerWidth();
  const [saving, startSaving] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const lastSaved = useRef(JSON.stringify(items.map(({ id, x, y, w, h }) => ({ id, x, y, w, h }))));

  const layout: Layout = items.map((it) => ({
    i: it.id,
    x: it.x,
    y: it.y,
    w: it.w,
    h: it.h,
    minW: 2,
    minH: 2,
  }));

  const persist = useCallback(
    (next: Layout) => {
      if (!editable || !onSaveLayout) return;
      const payload = next.map((l) => ({ id: l.i, x: l.x, y: l.y, w: l.w, h: l.h }));
      const serialized = JSON.stringify(payload);
      if (serialized === lastSaved.current) return;
      startSaving(async () => {
        try {
          await onSaveLayout(payload);
          lastSaved.current = serialized;
          setError(null);
        } catch {
          setError("版面儲存失敗，請重新整理再試一次");
        }
      });
    },
    [editable, onSaveLayout],
  );

  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);

  return (
    <div ref={containerRef}>
      {editable && (
        <p className="mb-2 h-4 text-right text-xs text-muted">
          {error ?? (saving ? "儲存中…" : "拖拉標題列移動，拖拉右下角調整大小")}
        </p>
      )}
      {mounted && width < MOBILE_BREAKPOINT ? (
        <div className="space-y-4">
          {sorted.map((it) => (
            <div key={it.id} style={{ minHeight: Math.max(it.h, 3) * ROW_HEIGHT }}>
              {it.node}
            </div>
          ))}
        </div>
      ) : mounted ? (
        <ReactGridLayout
          layout={layout}
          width={width}
          gridConfig={{
            cols: 12,
            rowHeight: ROW_HEIGHT,
            margin: [16, 16],
            containerPadding: [0, 0],
          }}
          dragConfig={{
            enabled: editable,
            handle: ".widget-drag-handle",
            cancel: ".widget-no-drag",
          }}
          resizeConfig={{ enabled: editable }}
          onDragStop={(next) => persist(next)}
          onResizeStop={(next) => persist(next)}
        >
          {items.map((it) => (
            <div key={it.id}>{it.node}</div>
          ))}
        </ReactGridLayout>
      ) : (
        <div className="space-y-4">
          {sorted.map((it) => (
            <div
              key={it.id}
              className="h-40 animate-pulse rounded-xl border border-border bg-surface"
            />
          ))}
        </div>
      )}
    </div>
  );
}
