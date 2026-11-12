/**
 * Item geometry in content coordinates.
 * `main` is the scroll axis, `cross` is the other one.
 */
export type LayoutEntry = {
  index: number;
  key: string;
  mainStart: number;
  mainEnd: number;
  crossStart: number;
  crossEnd: number;
};

/**
 * Finds the item under a point (content coordinates).
 * `entries` are sorted by `index`. Index order matches visual order:
 * rows top to bottom, left to right within a row. That holds for regular
 * lists and grids (`numColumns`), so binary search works.
 *
 * If the point falls into a gap (separator, spacing), pick the nearest item
 * in the same row, otherwise the nearest along the main axis, so the selection
 * doesn't stall while the finger crosses a separator.
 */
export const findEntryAt = (
  entries: readonly LayoutEntry[],
  main: number,
  cross: number,
): LayoutEntry | null => {
  'worklet';

  const count = entries.length;
  if (count === 0) {
    return null;
  }

  let low = 0;
  let high = count - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const entry = entries[mid]!;

    let cmp: number;
    if (main < entry.mainStart) {
      cmp = -1;
    } else if (main > entry.mainEnd) {
      cmp = 1;
    } else if (cross < entry.crossStart) {
      cmp = -1;
    } else if (cross > entry.crossEnd) {
      cmp = 1;
    } else {
      return entry;
    }

    if (cmp < 0) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  // No exact hit. Candidates are the neighbours of the insertion point.
  let best: LayoutEntry | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  const from = Math.max(0, high - 1);
  const to = Math.min(count - 1, low + 1);

  for (let i = from; i <= to; i += 1) {
    const entry = entries[i]!;
    const mainDist = main < entry.mainStart ? entry.mainStart - main : main > entry.mainEnd ? main - entry.mainEnd : 0;
    const crossDist =
      cross < entry.crossStart ? entry.crossStart - cross : cross > entry.crossEnd ? cross - entry.crossEnd : 0;
    // Main axis wins: a gap between rows is resolved by row, not by column.
    const score = mainDist * 1000 + crossDist;

    if (score < bestScore) {
      bestScore = score;
      best = entry;
    }
  }

  return best;
};

/** Inserts or replaces an entry keeping `index` order. Returns a new array. */
export const upsertEntry = (entries: readonly LayoutEntry[], next: LayoutEntry): LayoutEntry[] => {
  let low = 0;
  let high = entries.length - 1;

  while (low <= high) {
    const mid = (low + high) >> 1;
    const midIndex = entries[mid]!.index;

    if (midIndex === next.index) {
      const prev = entries[mid]!;
      if (
        prev.key === next.key &&
        prev.mainStart === next.mainStart &&
        prev.mainEnd === next.mainEnd &&
        prev.crossStart === next.crossStart &&
        prev.crossEnd === next.crossEnd
      ) {
        return entries as LayoutEntry[];
      }

      const copy = entries.slice();
      copy[mid] = next;
      return copy;
    }

    if (midIndex < next.index) {
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  const copy = entries.slice();
  copy.splice(low, 0, next);
  return copy;
};
