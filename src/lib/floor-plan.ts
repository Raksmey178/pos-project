// The floor plan of one zone is a grid of whole cells. Everything here is plain
// math with no database, so the screens and the server use exactly the same rules.

export const GRID_COLS = 24;
export const GRID_ROWS = 16;
export const MIN_TABLE_SIZE = 1;
export const MAX_TABLE_SIZE = 8;

/** A table on the grid: top-left cell (x, y) and its size in cells. */
export type Rect = { x: number; y: number; w: number; h: number };

/** True when the two rectangles share at least one cell. Touching edges do NOT overlap. */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

/** True when the whole rectangle lies inside the grid. */
export function fitsInGrid(rect: Rect): boolean {
  return (
    Number.isInteger(rect.x) &&
    Number.isInteger(rect.y) &&
    Number.isInteger(rect.w) &&
    Number.isInteger(rect.h) &&
    rect.w >= MIN_TABLE_SIZE &&
    rect.h >= MIN_TABLE_SIZE &&
    rect.x >= 0 &&
    rect.y >= 0 &&
    rect.x + rect.w <= GRID_COLS &&
    rect.y + rect.h <= GRID_ROWS
  );
}

/** Keeps a table's top-left corner so that the whole table stays inside the grid. */
export function clampPosition(x: number, y: number, w: number, h: number): { x: number; y: number } {
  return {
    x: Math.min(Math.max(x, 0), Math.max(GRID_COLS - w, 0)),
    y: Math.min(Math.max(y, 0), Math.max(GRID_ROWS - h, 0)),
  };
}

/**
 * Where a dragged table lands: it follows the finger by whole cells and never leaves the plan.
 * dxPx / dyPx = how far the finger moved in screen pixels, cellPx = the size of one grid cell on screen.
 */
export function dragTarget(
  start: { x: number; y: number },
  dxPx: number,
  dyPx: number,
  cellPx: number,
  w: number,
  h: number,
): { x: number; y: number } {
  if (!(cellPx > 0)) return clampPosition(start.x, start.y, w, h);
  return clampPosition(start.x + Math.round(dxPx / cellPx), start.y + Math.round(dyPx / cellPx), w, h);
}

export function overlapsAny(rect: Rect, others: readonly Rect[]): boolean {
  return others.some((other) => rectsOverlap(rect, other));
}

/**
 * The first free place (left to right, top to bottom) where a w x h table fits
 * without touching another table. null when the zone is full.
 */
export function findFreeSpot(taken: readonly Rect[], w: number, h: number): { x: number; y: number } | null {
  for (let y = 0; y + h <= GRID_ROWS; y++) {
    for (let x = 0; x + w <= GRID_COLS; x++) {
      if (!overlapsAny({ x, y, w, h }, taken)) return { x, y };
    }
  }
  return null;
}
