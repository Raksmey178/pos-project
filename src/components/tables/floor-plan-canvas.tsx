"use client";

import { useRef, useState } from "react";
import { dragTarget, GRID_COLS, GRID_ROWS, overlapsAny } from "@/lib/floor-plan";
import type { TableStatus } from "@/lib/table-status";

export type CanvasTable = {
  id: string;
  name: string;
  capacity: number;
  shape: "RECT" | "ROUND";
  gridX: number;
  gridY: number;
  width: number;
  height: number;
  status: TableStatus;
};

const STATUS_CLASS: Record<TableStatus, string> = {
  AVAILABLE: "border-green-600 bg-green-100 text-green-950 dark:bg-green-950 dark:text-green-100",
  OCCUPIED: "border-red-600 bg-red-100 text-red-950 dark:bg-red-950 dark:text-red-100",
  BILL_REQUESTED: "border-amber-600 bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100",
};

type Drag = { id: string; x: number; y: number; moved: boolean; blocked: boolean };

/**
 * Draws one zone's floor plan. In edit mode a table can be dragged with a finger or the mouse;
 * it snaps to whole grid cells and cannot leave the plan. The server checks every move again.
 */
export function FloorPlanCanvas({
  tables,
  editable = false,
  selectedId = null,
  onSelect,
  onMove,
  seatsLabel,
}: {
  tables: CanvasTable[];
  editable?: boolean;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  /** Called when a table is dropped on a different cell. */
  onMove?: (id: string, gridX: number, gridY: number) => void | Promise<void>;
  seatsLabel: (count: number) => string;
}) {
  const boardRef = useRef<HTMLDivElement>(null);
  const startRef = useRef<{ px: number; py: number; x: number; y: number; cell: number } | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);

  const gridStyle = editable
    ? {
        backgroundImage:
          "linear-gradient(to right, rgba(113,113,122,0.25) 1px, transparent 1px), linear-gradient(to bottom, rgba(113,113,122,0.25) 1px, transparent 1px)",
        backgroundSize: `${100 / GRID_COLS}% ${100 / GRID_ROWS}%`,
      }
    : {};

  function onPointerDown(event: React.PointerEvent<HTMLElement>, table: CanvasTable) {
    if (!editable || !boardRef.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    startRef.current = {
      px: event.clientX,
      py: event.clientY,
      x: table.gridX,
      y: table.gridY,
      cell: boardRef.current.getBoundingClientRect().width / GRID_COLS,
    };
    setDrag({ id: table.id, x: table.gridX, y: table.gridY, moved: false, blocked: false });
    onSelect?.(table.id);
  }

  function onPointerMove(event: React.PointerEvent<HTMLElement>, table: CanvasTable) {
    const start = startRef.current;
    if (!start || drag?.id !== table.id) return;

    const target = dragTarget(start, event.clientX - start.px, event.clientY - start.py, start.cell, table.width, table.height);
    const others = tables.filter((other) => other.id !== table.id).map((o) => ({ x: o.gridX, y: o.gridY, w: o.width, h: o.height }));
    const blocked = overlapsAny({ ...target, w: table.width, h: table.height }, others);
    setDrag({ id: table.id, ...target, moved: target.x !== table.gridX || target.y !== table.gridY, blocked });
  }

  async function onPointerUp(table: CanvasTable) {
    const finished = drag;
    startRef.current = null;
    setDrag(null);
    if (finished && finished.id === table.id && finished.moved) await onMove?.(table.id, finished.x, finished.y);
  }

  return (
    <div
      ref={boardRef}
      className="relative w-full select-none overflow-hidden rounded-2xl border border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900"
      style={{ aspectRatio: `${GRID_COLS} / ${GRID_ROWS}`, ...gridStyle }}
    >
      {tables.map((table) => {
        const dragging = drag?.id === table.id;
        const x = dragging ? drag.x : table.gridX;
        const y = dragging ? drag.y : table.gridY;
        const selected = selectedId === table.id;

        return (
          <div
            key={table.id}
            role={editable ? "button" : undefined}
            tabIndex={editable ? 0 : undefined}
            aria-pressed={editable ? selected : undefined}
            onClick={editable ? () => onSelect?.(table.id) : undefined}
            onPointerDown={(event) => onPointerDown(event, table)}
            onPointerMove={(event) => onPointerMove(event, table)}
            onPointerUp={() => void onPointerUp(table)}
            onPointerCancel={() => {
              startRef.current = null;
              setDrag(null);
            }}
            className={`absolute flex flex-col items-center justify-center overflow-hidden border-2 text-center leading-tight ${
              table.shape === "ROUND" ? "rounded-full" : "rounded-xl"
            } ${dragging && drag.blocked ? "border-red-600 bg-red-200 text-red-950" : STATUS_CLASS[table.status]} ${
              selected ? "ring-4 ring-zinc-900 dark:ring-zinc-100" : ""
            } ${editable ? "cursor-grab active:cursor-grabbing" : ""}`}
            style={{
              left: `${(x / GRID_COLS) * 100}%`,
              top: `${(y / GRID_ROWS) * 100}%`,
              width: `${(table.width / GRID_COLS) * 100}%`,
              height: `${(table.height / GRID_ROWS) * 100}%`,
              touchAction: editable ? "none" : "auto",
              zIndex: dragging ? 10 : 1,
            }}
          >
            <span className="max-w-full truncate px-1 text-sm font-semibold sm:text-xl">{table.name}</span>
            <span className="hidden max-w-full truncate px-1 text-xs opacity-80 sm:block sm:text-sm">{seatsLabel(table.capacity)}</span>
          </div>
        );
      })}
    </div>
  );
}
