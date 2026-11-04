import { describe, expect, it } from "vitest";
import {
  clampPosition,
  dragTarget,
  findFreeSpot,
  fitsInGrid,
  GRID_COLS,
  GRID_ROWS,
  overlapsAny,
  rectsOverlap,
  type Rect,
} from "./floor-plan";

const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

describe("rectsOverlap", () => {
  it("detects overlapping and separate tables", () => {
    expect(rectsOverlap(r(0, 0, 2, 2), r(1, 1, 2, 2))).toBe(true);
    expect(rectsOverlap(r(0, 0, 2, 2), r(5, 5, 2, 2))).toBe(false);
  });

  it("tables that only touch along an edge do not overlap", () => {
    expect(rectsOverlap(r(0, 0, 2, 2), r(2, 0, 2, 2))).toBe(false); // side by side
    expect(rectsOverlap(r(0, 0, 2, 2), r(0, 2, 2, 2))).toBe(false); // one above the other
    expect(rectsOverlap(r(0, 0, 2, 2), r(2, 2, 2, 2))).toBe(false); // corner to corner
  });

  it("a table fully inside another, and identical tables, overlap", () => {
    expect(rectsOverlap(r(0, 0, 6, 6), r(2, 2, 1, 1))).toBe(true);
    expect(rectsOverlap(r(3, 3, 2, 2), r(3, 3, 2, 2))).toBe(true);
  });

  it("is the same in both directions", () => {
    expect(rectsOverlap(r(1, 1, 3, 1), r(2, 0, 1, 3))).toBe(rectsOverlap(r(2, 0, 1, 3), r(1, 1, 3, 1)));
  });
});

describe("fitsInGrid", () => {
  it("accepts tables inside the grid, including the last cell", () => {
    expect(fitsInGrid(r(0, 0, 2, 2))).toBe(true);
    expect(fitsInGrid(r(GRID_COLS - 2, GRID_ROWS - 2, 2, 2))).toBe(true);
  });

  it("rejects tables that stick out or have bad numbers", () => {
    expect(fitsInGrid(r(GRID_COLS - 1, 0, 2, 2))).toBe(false);
    expect(fitsInGrid(r(0, GRID_ROWS - 1, 2, 2))).toBe(false);
    expect(fitsInGrid(r(-1, 0, 2, 2))).toBe(false);
    expect(fitsInGrid(r(0, 0, 0, 2))).toBe(false);
    expect(fitsInGrid(r(0.5, 0, 2, 2))).toBe(false);
  });
});

describe("clampPosition", () => {
  it("keeps the whole table inside the grid", () => {
    expect(clampPosition(-3, -1, 2, 2)).toEqual({ x: 0, y: 0 });
    expect(clampPosition(100, 100, 2, 3)).toEqual({ x: GRID_COLS - 2, y: GRID_ROWS - 3 });
    expect(clampPosition(5, 5, 2, 2)).toEqual({ x: 5, y: 5 });
  });
});

describe("findFreeSpot", () => {
  it("starts at the top-left of an empty zone", () => {
    expect(findFreeSpot([], 2, 2)).toEqual({ x: 0, y: 0 });
  });

  it("goes left to right, then to the next row", () => {
    expect(findFreeSpot([r(0, 0, 2, 2)], 2, 2)).toEqual({ x: 2, y: 0 });

    const fullRow: Rect[] = Array.from({ length: GRID_COLS / 2 }, (_, i) => r(i * 2, 0, 2, 2));
    expect(findFreeSpot(fullRow, 2, 2)).toEqual({ x: 0, y: 2 });
  });

  it("finds a gap between tables", () => {
    expect(findFreeSpot([r(0, 0, 2, 2), r(4, 0, 2, 2)], 2, 2)).toEqual({ x: 2, y: 0 });
  });

  it("returns null when the zone is full", () => {
    const wall = Array.from({ length: GRID_ROWS }, (_, y) => r(0, y, GRID_COLS, 1));
    expect(findFreeSpot(wall, 1, 1)).toBeNull();
  });

  it("a placed table never overlaps the others", () => {
    const taken: Rect[] = [];
    for (let i = 0; i < 20; i++) {
      const spot = findFreeSpot(taken, 3, 2);
      expect(spot).not.toBeNull();
      const next = { ...spot!, w: 3, h: 2 };
      expect(overlapsAny(next, taken)).toBe(false);
      expect(fitsInGrid(next)).toBe(true);
      taken.push(next);
    }
  });
});

describe("dragTarget", () => {
  const start = { x: 5, y: 5 };
  const cell = 40; // 40 screen pixels per grid cell

  it("does not move for a small wobble", () => {
    expect(dragTarget(start, 10, -15, cell, 2, 2)).toEqual({ x: 5, y: 5 });
  });

  it("follows the finger in whole cells", () => {
    expect(dragTarget(start, 85, 0, cell, 2, 2)).toEqual({ x: 7, y: 5 }); // 2.1 cells
    expect(dragTarget(start, 0, 130, cell, 2, 2)).toEqual({ x: 5, y: 8 }); // 3.25 cells
    expect(dragTarget(start, -85, -45, cell, 2, 2)).toEqual({ x: 3, y: 4 });
  });

  it("stays inside the plan", () => {
    expect(dragTarget(start, -9999, -9999, cell, 2, 2)).toEqual({ x: 0, y: 0 });
    expect(dragTarget(start, 9999, 9999, cell, 3, 2)).toEqual({ x: GRID_COLS - 3, y: GRID_ROWS - 2 });
  });

  it("ignores a broken cell size", () => {
    expect(dragTarget(start, 100, 100, 0, 2, 2)).toEqual({ x: 5, y: 5 });
    expect(dragTarget(start, 100, 100, Number.NaN, 2, 2)).toEqual({ x: 5, y: 5 });
  });
});
