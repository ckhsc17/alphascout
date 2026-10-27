export interface GridPosition {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const GRID_COLUMNS = 12;

/**
 * Finds the first free slot for a w×h widget, scanning rows top to bottom and columns left to
 * right, so new widgets fill gaps before extending the dashboard.
 */
export function placeWidget(
  existing: GridPosition[],
  size: { w: number; h: number },
): GridPosition {
  const w = Math.min(Math.max(1, size.w), GRID_COLUMNS);
  const h = Math.max(1, size.h);
  const overlaps = (a: GridPosition, b: GridPosition) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

  const bottom = existing.reduce((max, p) => Math.max(max, p.y + p.h), 0);
  for (let y = 0; y <= bottom; y++) {
    for (let x = 0; x + w <= GRID_COLUMNS; x++) {
      const candidate = { x, y, w, h };
      if (!existing.some((p) => overlaps(candidate, p))) return candidate;
    }
  }
  return { x: 0, y: bottom, w, h };
}

/** Clamps a client-supplied position onto the grid. */
export function normalizePosition(p: GridPosition): GridPosition {
  const w = Math.min(Math.max(1, Math.round(p.w)), GRID_COLUMNS);
  return {
    x: Math.min(Math.max(0, Math.round(p.x)), GRID_COLUMNS - w),
    y: Math.max(0, Math.round(p.y)),
    w,
    h: Math.min(Math.max(1, Math.round(p.h)), 24),
  };
}

const ID_ALPHABET = "0123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";

/** Short URL-safe random id, e.g. for /d/<id>. 10 chars ≈ 58 bits. */
export function shortId(length = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("");
}
