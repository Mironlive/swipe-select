export type IndexRange = {
  start: number;
  end: number;
};

export type ApplyRangeParams = {
  /** Selection at the moment the gesture started. */
  initial: ReadonlySet<string>;
  /** Current selection (after the previous gesture step). */
  current: ReadonlySet<string>;
  previousRange: IndexRange | null;
  nextRange: IndexRange;
  shouldSelect: boolean;
  getKeyByIndex: (index: number) => string | null;
  isSelectableIndex?: (index: number) => boolean;
};

export type ApplyRangeResult = {
  /** New selection. If `changed === false`, it is the same object as `current`. */
  next: ReadonlySet<string>;
  changed: boolean;
};


/**
 * Transition between gesture ranges.
 * Indices inside `nextRange` get `shouldSelect`.
 * Indices that left the range go back to their state at gesture start.
 * Only the difference between ranges is processed, not the whole range — O(Δ).
 */
export const applyRangeTransition = ({
  initial,
  current,
  previousRange,
  nextRange,
  shouldSelect,
  getKeyByIndex,
  isSelectableIndex,
}: ApplyRangeParams): ApplyRangeResult => {
  // The Set is copied lazily — only on the first real change.
  // The finger often moves over rows already processed, and then there's nothing to copy.
  let next: Set<string> | null = null;

  const apply = (start: number, end: number, mode: 'add' | 'restore') => {
    for (let index = start; index <= end; index += 1) {
      if (isSelectableIndex && !isSelectableIndex(index)) {
        continue;
      }

      const key = getKeyByIndex(index);
      if (key === null) {
        continue;
      }

      const selected = mode === 'add' ? shouldSelect : initial.has(key);
      const source = next ?? current;
      if (source.has(key) === selected) {
        continue;
      }
      if (!next) {
        next = new Set(current);
      }
      if (selected) {
        next.add(key);
      } else {
        next.delete(key);
      }
    }
  };

  const result = (): ApplyRangeResult =>
    next ? { next, changed: true } : { next: current as Set<string>, changed: false };

  if (!previousRange) {
    apply(nextRange.start, nextRange.end, 'add');
    return result();
  }

  // Left the range — restore the initial state.
  if (previousRange.start < nextRange.start) {
    apply(previousRange.start, Math.min(previousRange.end, nextRange.start - 1), 'restore');
  }
  if (previousRange.end > nextRange.end) {
    apply(Math.max(previousRange.start, nextRange.end + 1), previousRange.end, 'restore');
  }

  // Entered the range — apply the gesture mode.
  if (nextRange.start < previousRange.start) {
    apply(nextRange.start, Math.min(nextRange.end, previousRange.start - 1), 'add');
  }
  if (nextRange.end > previousRange.end) {
    apply(Math.max(nextRange.start, previousRange.end + 1), nextRange.end, 'add');
  }

  return result();
};

export const sameKeys = (set: ReadonlySet<string>, keys: Iterable<string>) => {
  let count = 0;
  for (const key of keys) {
    if (!set.has(key)) {
      return false;
    }
    count += 1;
  }
  return count === set.size;
};
