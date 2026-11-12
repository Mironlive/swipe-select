import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LayoutChangeEvent, LayoutRectangle } from 'react-native';
import { View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import * as Reanimated from 'react-native-reanimated';
import { runOnJS, scrollTo, useAnimatedRef, useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { findEntryAt } from './internal/hitTest';
import type { LayoutEntry } from './internal/hitTest';
import { applyRangeTransition } from './internal/range';
import type { IndexRange } from './internal/range';
import { useSelectionState } from './internal/useSelectionState';
import type {
  ActivationWhen,
  AutoScrollConfig,
  SwipeSelectActivation,
  DragMode,
  SwipeSelectListProps,
  ItemLayout,
  SelectionKey,
  UseSwipeSelectOptions,
  UseSwipeSelectResult,
} from './types';

const DEFAULT_EDGE_SIZE = 56;
const DEFAULT_LONG_PRESS_MS = 300;
const DEFAULT_PAN_DISTANCE = 10;
const EDGE_SLOP = 4;
// Geometry window on the UI thread: this many screens before and after the current one.
const WINDOW_BEFORE = 3;
const WINDOW_AFTER = 4;
const WINDOW_MIN_ENTRIES = 400;
const LEGEND_MARGIN = 30;
const DEFAULT_AUTO_SCROLL: Required<AutoScrollConfig> = { edgeSize: 60, maxSpeed: 900, minSpeed: 120 };

// Activation types as numbers — cheaper inside worklets.
const ACT_EDGE = 0;
const ACT_LONG_PRESS = 1;
const ACT_PAN = 2;

const WHEN_ALWAYS = 0;
const WHEN_SELECTION = 1;
const WHEN_IDLE = 2;

type NormalizedActivation = {
  type: number;
  when: number;
  side: number;
  size: number;
  minDuration: number;
  distance: number;
};

const WHEN_MAP: Record<ActivationWhen, number> = { always: WHEN_ALWAYS, selectionMode: WHEN_SELECTION, idle: WHEN_IDLE };

const normalizeActivations = (
  activation: SwipeSelectActivation | readonly SwipeSelectActivation[] | undefined,
): NormalizedActivation[] => {
  const list = activation === undefined ? [{ type: 'edge' } as const] : Array.isArray(activation) ? activation : [activation];
  return (list as readonly SwipeSelectActivation[]).map((item) => {
    const type = item.type === 'longPress' ? ACT_LONG_PRESS : item.type === 'pan' ? ACT_PAN : ACT_EDGE;
    const defaultWhen: ActivationWhen = type === ACT_LONG_PRESS ? 'always' : 'selectionMode';
    return {
      type,
      when: WHEN_MAP[item.when ?? defaultWhen],
      side: item.type === 'edge' && item.side === 'right' ? 1 : 0,
      size: (item.type === 'edge' && item.size) || DEFAULT_EDGE_SIZE,
      minDuration: (item.type === 'longPress' && item.minDuration) || DEFAULT_LONG_PRESS_MS,
      distance: (item.type === 'pan' && item.activationDistance) || DEFAULT_PAN_DISTANCE,
    };
  });
};

type DragSession = {
  initial: ReadonlySet<SelectionKey>;
  previousRange: IndexRange | null;
  mode: DragMode;
  lastHoverIndex: number;
  anchorKey: SelectionKey;
  hoverKey: SelectionKey;
};

// Reanimated 4: useScrollOffset, Reanimated 3: useScrollViewOffset.
const useScrollOffsetCompat: (ref: any) => Reanimated.SharedValue<number> =
  (Reanimated as any).useScrollOffset ?? (Reanimated as any).useScrollViewOffset;

const toArray = (keys: SelectionKey | readonly SelectionKey[]) =>
  (typeof keys === 'string' ? [keys] : keys) as readonly SelectionKey[];

/**
 * Swipe to multi-select: hold, drag, and items under the finger get selected;
 * the list auto-scrolls near the edges.
 *
 * Headless: you render checkboxes, highlights and counters yourself.
 */
export const useSwipeSelect = <T,>(options: UseSwipeSelectOptions<T>): UseSwipeSelectResult<T> => {
  const {
    data,
    keyExtractor,
    selectedKeys,
    defaultSelectedKeys,
    onSelectionChange,
    activation,
    selectionMode,
    enabled = true,
    horizontal = false,
    inverted = false,
    numColumns = 1,
    autoScroll = true,
  } = options;

  // ---------- config ----------
  // Several activations at once, e.g. long press outside selection mode + edge strip inside it.
  const activations = useMemo(
    () => normalizeActivations(activation),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [JSON.stringify(activation ?? null)],
  );

  const autoScrollConfig = autoScroll === false ? null : { ...DEFAULT_AUTO_SCROLL, ...(autoScroll === true ? {} : autoScroll) };
  const autoScrollEnabled = autoScrollConfig !== null;
  const autoEdge = autoScrollConfig?.edgeSize ?? 0;
  const autoMax = autoScrollConfig?.maxSpeed ?? 0;
  const autoMin = autoScrollConfig?.minSpeed ?? 0;

  // ---------- refs to the latest props ----------
  const latest = useRef(options);
  latest.current = options;

  const dataRef = useRef(data ?? []);
  dataRef.current = data ?? [];

  const getKeyByIndex = useCallback((index: number): SelectionKey | null => {
    const item = dataRef.current[index];
    return item === undefined ? null : latest.current.keyExtractor(item, index);
  }, []);

  const isSelectableIndex = useCallback((index: number) => {
    const check = latest.current.isItemSelectable;
    if (!check) return true;
    const item = dataRef.current[index];
    return item !== undefined && check(item, index);
  }, []);

  // ---------- selection state ----------
  const {
    selected,
    ref: selectedRef,
    schedule,
    commit,
    flush,
    emit,
  } = useSelectionState({ selectedKeys, defaultSelectedKeys, onSelectionChange });
  const selectedCount = selected.size;
  const isSelectionMode = selectionMode ?? selectedCount > 0;

  const [isDragging, setIsDragging] = useState(false);
  const frameControlRef = useRef<{ setActive: (active: boolean) => void } | null>(null);
  const dragRef = useRef<DragSession | null>(null);

  // ---------- shared values ----------
  // listRef — the native ScrollView (for scrollTo and reading scroll on the UI thread).
  // listInstanceRef — the list component itself (FlatList / FlashList / LegendList).
  const listRef = useAnimatedRef<any>();
  const listInstanceRef = useRef<any>(null);

  const attachScrollNode = useCallback(() => {
    const instance = listInstanceRef.current;
    if (!instance) return;
    let node: any = null;
    try {
      node = instance.getNativeScrollRef?.() ?? null;
    } catch {
      node = null;
    }
    const target = node ?? instance;
    if ((listRef as any).current !== target) {
      (listRef as any)(target);
    }
  }, [listRef]);

  const setListInstance = useCallback(
    (instance: any) => {
      listInstanceRef.current = instance;
      if (instance) attachScrollNode();
    },
    [attachScrollNode],
  );

  const entriesSv = useSharedValue<LayoutEntry[]>([]);
  const listMainSv = useSharedValue(0); // list position inside the container along the main axis
  const listCrossSv = useSharedValue(0);
  const viewportMainSv = useSharedValue(0); // viewport size
  const viewportCrossSv = useSharedValue(0);
  const contentMainSv = useSharedValue(0);
  // Scroll offset is read from the native ScrollView directly — the list doesn't need onScroll.
  const scrollSv = useScrollOffsetCompat(listRef);

  const touchMainSv = useSharedValue(0); // last touch, container coordinates
  const touchCrossSv = useSharedValue(0);
  const startMainSv = useSharedValue(0); // touch-down point (for pan activation)
  const startCrossSv = useSharedValue(0);

  const draggingSv = useSharedValue(0);
  const ownerSv = useSharedValue(-1); // which of the gestures owns the drag
  const anchorSv = useSharedValue(-1);
  const hoverSv = useSharedValue(-1);
  const rangeStartSv = useSharedValue(-1);
  const rangeEndSv = useSharedValue(-1);
  const autoScrollDirectionSv = useSharedValue(0);
  const autoActiveSv = useSharedValue(0); // auto-scroll currently running
  const autoOffsetSv = useSharedValue(0); // auto-scroll's own offset
  const lastFrameTsSv = useSharedValue(0);

  const enabledSv = useSharedValue(enabled ? 1 : 0);
  const selectionModeSv = useSharedValue(isSelectionMode ? 1 : 0);

  useEffect(() => {
    enabledSv.value = enabled ? 1 : 0;
  }, [enabled, enabledSv]);

  useEffect(() => {
    selectionModeSv.value = isSelectionMode ? 1 : 0;
  }, [isSelectionMode, selectionModeSv]);

  // ---------- geometry registry ----------
  // The full registry lives in JS (Map — O(1) per update).
  // Only a window around the viewport is sent to the UI thread — otherwise with 10k+ items
  // every update would copy the whole array between threads.
  const entriesRef = useRef<Map<number, LayoutEntry>>(new Map());
  const entriesRafRef = useRef<number | null>(null);

  // Scroll and viewport size are mirrored in JS: reading a shared value from JS is
  // a synchronous call into the UI thread, and we need them on every window shift.
  const jsScrollRef = useRef(0);
  const jsViewportRef = useRef(0);

  const flushEntries = useCallback(() => {
    const all = entriesRef.current;
    const viewport = jsViewportRef.current;
    const scroll = jsScrollRef.current;
    const windowed: LayoutEntry[] = [];

    if (viewport <= 0 || all.size <= WINDOW_MIN_ENTRIES) {
      all.forEach((entry) => windowed.push(entry));
    } else {
      const lo = scroll - viewport * WINDOW_BEFORE;
      const hi = scroll + viewport * WINDOW_AFTER;
      all.forEach((entry) => {
        if (entry.mainEnd >= lo && entry.mainStart <= hi) windowed.push(entry);
      });
    }

    windowed.sort((left, right) => left.index - right.index);
    entriesSv.value = windowed;
  }, [entriesSv]);

  const pushEntries = useCallback(() => {
    if (entriesRafRef.current !== null) return;
    entriesRafRef.current = requestAnimationFrame(() => {
      entriesRafRef.current = null;
      flushEntries();
    });
  }, [flushEntries]);

  useEffect(
    () => () => {
      if (entriesRafRef.current !== null) cancelAnimationFrame(entriesRafRef.current);
    },
    [],
  );

  const horizontalRef = useRef(horizontal);
  horizontalRef.current = horizontal;
  const numColumnsRef = useRef(numColumns);
  numColumnsRef.current = numColumns;

  const onItemLayout = useCallback(
    ({ index, key, x, y, width, height }: ItemLayout) => {
      const h = horizontalRef.current;
      const next: LayoutEntry = {
        index,
        key,
        mainStart: h ? x : y,
        mainEnd: h ? x + width : y + height,
        crossStart: h ? y : x,
        crossEnd: h ? y + height : x + width,
      };
      const prev = entriesRef.current.get(index);
      if (
        prev &&
        prev.key === next.key &&
        prev.mainStart === next.mainStart &&
        prev.mainEnd === next.mainEnd &&
        prev.crossStart === next.crossStart &&
        prev.crossEnd === next.crossEnd
      ) {
        return;
      }
      entriesRef.current.set(index, next);
      pushEntries();
    },
    [pushEntries],
  );

  /** List cell geometry. For FlatList with numColumns a cell is a whole row. */
  const onCellLayout = useCallback(
    (cellIndex: number, layout: LayoutRectangle, isRow: boolean) => {
      const columns = isRow ? Math.max(1, numColumnsRef.current) : 1;

      for (let column = 0; column < columns; column += 1) {
        const index = cellIndex * columns + column;
        const key = getKeyByIndex(index);
        if (key === null) continue;

        if (columns === 1) {
          onItemLayout({ index, key, ...layout });
          continue;
        }

        // FlatList columns are usually equal width — split the row evenly.
        if (horizontalRef.current) {
          const size = layout.height / columns;
          onItemLayout({ index, key, x: layout.x, y: layout.y + size * column, width: layout.width, height: size });
        } else {
          const size = layout.width / columns;
          onItemLayout({ index, key, x: layout.x + size * column, y: layout.y, width: size, height: layout.height });
        }
      }
    },
    [getKeyByIndex, onItemLayout],
  );

  // Data changed — drop geometry whose index now holds a different key.
  useEffect(() => {
    const list = data ?? [];
    let removed = false;
    entriesRef.current.forEach((entry, index) => {
      const item = list[index];
      if (item === undefined || keyExtractor(item, index) !== entry.key) {
        entriesRef.current.delete(index);
        removed = true;
      }
    });
    if (removed) pushEntries();
    // keyExtractor is often inline — don't make it a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, pushEntries]);

  // ---------- gesture, JS side ----------
  const applyRange = useCallback(
    (start: number, end: number) => {
      const drag = dragRef.current;
      if (!drag) return;

      const nextRange = { start, end };
      const result = applyRangeTransition({
        initial: drag.initial,
        current: selectedRef.current,
        previousRange: drag.previousRange,
        nextRange,
        shouldSelect: drag.mode === 'select',
        getKeyByIndex,
        isSelectableIndex: latest.current.isItemSelectable ? isSelectableIndex : undefined,
      });
      drag.previousRange = nextRange;

      if (result.changed) {
        schedule(result.next);
      }
    },
    [getKeyByIndex, isSelectableIndex, schedule, selectedRef],
  );

  const handleDragStart = useCallback(
    (index: number) => {
      const key = getKeyByIndex(index);
      if (key === null || !isSelectableIndex(index)) {
        dragRef.current = null;
        return;
      }

      flush();
      const current = selectedRef.current;
      const mode: DragMode = current.has(key) ? 'deselect' : 'select';

      dragRef.current = {
        initial: current,
        previousRange: null,
        mode,
        lastHoverIndex: index,
        anchorKey: key,
        hoverKey: key,
      };
      applyRange(index, index);
      setIsDragging(true);
      frameControlRef.current?.setActive(true);
      latest.current.onDragStart?.({ key, index, mode });
    },
    [applyRange, flush, getKeyByIndex, isSelectableIndex, selectedRef],
  );

  const handleDragMove = useCallback(
    (start: number, end: number, hoverIndex: number, isAutoScrolling: boolean) => {
      const drag = dragRef.current;
      if (!drag) return;

      applyRange(start, end);

      if (hoverIndex !== drag.lastHoverIndex) {
        drag.lastHoverIndex = hoverIndex;
        const key = getKeyByIndex(hoverIndex);
        if (key !== null) {
          drag.hoverKey = key;
          latest.current.onItemEnter?.({ key, index: hoverIndex, mode: drag.mode, isAutoScrolling });
        }
      }
    },
    [applyRange, getKeyByIndex],
  );

  const handleDragEnd = useCallback(() => {
    const drag = dragRef.current;
    dragRef.current = null;
    setIsDragging(false);
    frameControlRef.current?.setActive(false);
    if (!drag) return;

    flush();
    if (drag.initial !== selectedRef.current) {
      emit('gesture');
    }
    latest.current.onDragEnd?.({ selectedKeys: Array.from(selectedRef.current), mode: drag.mode });
  }, [emit, flush, selectedRef]);

  // Data changed mid-gesture (a new email arrived, an item was removed):
  // indices shifted — remap the anchor and the range by keys.
  const prevDataRef = useRef(data ?? []);
  useEffect(() => {
    const prevData = prevDataRef.current;
    const nextData = data ?? [];
    prevDataRef.current = nextData;

    const drag = dragRef.current;
    if (!drag || prevData === nextData || !drag.previousRange) return;

    const extract = latest.current.keyExtractor;
    const indexOf = (key: SelectionKey) => {
      for (let i = 0; i < nextData.length; i += 1) {
        if (extract(nextData[i]!, i) === key) return i;
      }
      return -1;
    };

    const anchor = indexOf(drag.anchorKey);
    if (anchor === -1) {
      // The anchor is gone — nothing to extend the range from: end the gesture now.
      dragRef.current = null;
      frameControlRef.current?.setActive(false);
      flush();
      if (drag.initial !== selectedRef.current) emit('gesture');
      latest.current.onDragEnd?.({ selectedKeys: Array.from(selectedRef.current), mode: drag.mode });
      return;
    }
    const hoverFound = indexOf(drag.hoverKey);
    const hover = hoverFound === -1 ? anchor : hoverFound;
    const nextRange = { start: Math.min(anchor, hover), end: Math.max(anchor, hover) };

    const next = new Set(selectedRef.current);
    // Old range (old indices) — restore to the initial state...
    for (let i = drag.previousRange.start; i <= drag.previousRange.end; i += 1) {
      const item = prevData[i];
      if (item === undefined) continue;
      const key = extract(item, i);
      if (drag.initial.has(key)) next.add(key);
      else next.delete(key);
    }
    // ...and apply the new one.
    for (let i = nextRange.start; i <= nextRange.end; i += 1) {
      if (!isSelectableIndex(i)) continue;
      const key = extract(nextData[i]!, i);
      if (drag.mode === 'select') next.add(key);
      else next.delete(key);
    }

    drag.previousRange = nextRange;
    drag.lastHoverIndex = hover;
    anchorSv.value = anchor;
    hoverSv.value = hover;
    rangeStartSv.value = nextRange.start;
    rangeEndSv.value = nextRange.end;
    schedule(next);
  }, [anchorSv, data, emit, flush, hoverSv, isSelectableIndex, rangeEndSv, rangeStartSv, schedule, selectedRef]);

  // ---------- gesture, UI side (worklets) ----------
  const hitTest = useCallback(
    (main: number, cross: number) => {
      'worklet';
      const local = main - listMainSv.value;
      // inverted: the list is flipped, content starts at the visual bottom.
      const contentMain = inverted ? scrollSv.value + viewportMainSv.value - local : local + scrollSv.value;
      const contentCross = cross - listCrossSv.value;
      return findEntryAt(entriesSv.value, contentMain, contentCross);
    },
    [entriesSv, inverted, listCrossSv, listMainSv, scrollSv, viewportMainSv],
  );

  const warnNoLayouts = useCallback(() => {
    if (__DEV__ && (dataRef.current.length ?? 0) > 0) {
      console.warn(
        '[swipe-select] No item geometry: the gesture does not know where the rows are. ' +
          'Make sure {...selection.listProps} is spread onto the list and the list accepts CellRendererComponent. ' +
          "Reanimated's `Animated.FlatList` does NOT accept it — use SwipeSelectFlatList " +
          'or Animated.createAnimatedComponent(FlatList). With a custom CellRendererComponent call selection.onItemLayout.',
      );
    }
  }, []);

  const beginDrag = useCallback(
    (main: number, cross: number, owner: number) => {
      'worklet';
      const entry = hitTest(main, cross);
      if (entriesSv.value.length === 0) runOnJS(warnNoLayouts)();
      if (!entry) return false;

      draggingSv.value = 1;
      ownerSv.value = owner;
      anchorSv.value = entry.index;
      hoverSv.value = entry.index;
      rangeStartSv.value = entry.index;
      rangeEndSv.value = entry.index;
      runOnJS(handleDragStart)(entry.index);
      return true;
    },
    [anchorSv, draggingSv, entriesSv, handleDragStart, hitTest, hoverSv, ownerSv, rangeEndSv, rangeStartSv, warnNoLayouts],
  );

  const updateDrag = useCallback(
    (isAutoScrolling: boolean) => {
      'worklet';
      if (draggingSv.value !== 1) return;

      const entry = hitTest(touchMainSv.value, touchCrossSv.value);
      if (!entry) return;

      const anchor = anchorSv.value;
      const start = Math.min(anchor, entry.index);
      const end = Math.max(anchor, entry.index);

      if (start === rangeStartSv.value && end === rangeEndSv.value && entry.index === hoverSv.value) return;

      rangeStartSv.value = start;
      rangeEndSv.value = end;
      hoverSv.value = entry.index;
      runOnJS(handleDragMove)(start, end, entry.index, isAutoScrolling);
    },
    [anchorSv, draggingSv, handleDragMove, hitTest, hoverSv, rangeEndSv, rangeStartSv, touchCrossSv, touchMainSv],
  );

  const updateAutoScrollDirection = useCallback(() => {
    'worklet';
    if (!autoScrollEnabled) {
      autoScrollDirectionSv.value = 0;
      return;
    }
    const local = touchMainSv.value - listMainSv.value;
    const size = viewportMainSv.value;
    autoScrollDirectionSv.value = local < autoEdge ? -1 : local > size - autoEdge ? 1 : 0;
  }, [autoEdge, autoScrollDirectionSv, autoScrollEnabled, listMainSv, touchMainSv, viewportMainSv]);

  const finishDrag = useCallback((owner: number) => {
    'worklet';
    // In a Race the losing gestures finalize too — don't touch someone else's drag.
    if (ownerSv.value !== owner) return;
    ownerSv.value = -1;
    const wasDragging = draggingSv.value === 1;
    draggingSv.value = 0;
    anchorSv.value = -1;
    hoverSv.value = -1;
    rangeStartSv.value = -1;
    rangeEndSv.value = -1;
    autoScrollDirectionSv.value = 0;
    autoActiveSv.value = 0;
    if (wasDragging) {
      runOnJS(handleDragEnd)();
    }
  }, [anchorSv, autoActiveSv, autoScrollDirectionSv, draggingSv, handleDragEnd, hoverSv, ownerSv, rangeEndSv, rangeStartSv]);

  // Auto-scroll: speed ramps up towards the edge and doesn't depend on refresh rate (60/120 Hz).
  const onFrame = useCallback((frame: Reanimated.FrameInfo) => {
    'worklet';
    if (draggingSv.value !== 1) return;

    const direction = autoScrollDirectionSv.value;
    if (direction === 0) {
      autoActiveSv.value = 0;
      return;
    }

    // Auto-scroll keeps its own offset. The native scroll offset arrives with a lag,
    // and building on it makes the speed jitter (noticeable on Android).
    if (autoActiveSv.value === 0) {
      autoActiveSv.value = 1;
      autoOffsetSv.value = scrollSv.value;
      lastFrameTsSv.value = frame.timestamp;
      return;
    }

    // Measure elapsed time ourselves. On Android the callback can fire several times per frame
    // with timestamps from two clocks (deltas like +17, -0.5, +1), so timeSincePreviousFrame
    // is unreliable. Only real forward time counts; repeated calls are skipped.
    const rawDt = frame.timestamp - lastFrameTsSv.value;
    if (rawDt <= 0) return;
    lastFrameTsSv.value = frame.timestamp;
    const dt = rawDt < 100 ? rawDt : 16;

    const local = touchMainSv.value - listMainSv.value;
    const size = viewportMainSv.value;
    const depth = direction < 0 ? autoEdge - local : local - (size - autoEdge);
    const ratio = Math.min(1, Math.max(0, depth / Math.max(1, autoEdge)));
    const speed = autoMin + (autoMax - autoMin) * ratio;

    const maxOffset = Math.max(0, contentMainSv.value - size);
    const current = autoOffsetSv.value;
    // direction is visual (-1 towards the top of the screen). Inverted lists scroll the other way.
    const scrollDirection = inverted ? -direction : direction;
    const next = Math.min(maxOffset, Math.max(0, current + scrollDirection * speed * (dt / 1000)));
    if (next === current) return;

    autoOffsetSv.value = next;
    scrollSv.value = next;
    if (horizontal) {
      scrollTo(listRef, next, 0, false);
    } else {
      scrollTo(listRef, 0, next, false);
    }
    updateDrag(true);
  }, [
    autoActiveSv,
    autoEdge,
    autoMax,
    autoMin,
    autoOffsetSv,
    autoScrollDirectionSv,
    lastFrameTsSv,
    contentMainSv,
    draggingSv,
    horizontal,
    inverted,
    listMainSv,
    listRef,
    scrollSv,
    touchMainSv,
    updateDrag,
    viewportMainSv,
  ]);
  // The callback is memoized: useFrameCallback re-registers it whenever it changes.
  // Runs only during a gesture — costs nothing at rest.
  const frameCallback = useFrameCallback(onFrame, false);
  frameControlRef.current = frameCallback;

  const gesture = useMemo(() => {
    const pickMain = (x: number, y: number) => {
      'worklet';
      return horizontal ? x : y;
    };
    const pickCross = (x: number, y: number) => {
      'worklet';
      return horizontal ? y : x;
    };

    const makePan = (config: NormalizedActivation, id: number) => {
      const when = config.when;
      const canStart = () => {
        'worklet';
        if (enabledSv.value !== 1) return false;
        if (draggingSv.value === 1) return false;
        const mode = selectionModeSv.value === 1;
        if (when === WHEN_SELECTION && !mode) return false;
        if (when === WHEN_IDLE && mode) return false;
        return true;
      };

      let pan = Gesture.Pan();

      if (config.type === ACT_EDGE) {
        const side = config.side;
        const size = config.size;
        // Activate after the finger moves EDGE_SLOP px, not on touch-down.
        // Otherwise RN touches (Pressable) start after us and aren't cancelled —
        // a tap would toggle the checkbox twice. This way: tap → your onPress, drag → the gesture.
        pan = pan
          .manualActivation(true)
          .onTouchesDown((event, manager) => {
            'worklet';
            const touch = event.allTouches[0];
            if (!touch || !canStart()) {
              manager.fail();
              return;
            }
            const cross = pickCross(touch.x, touch.y) - listCrossSv.value;
            const viewport = viewportCrossSv.value;
            const inEdge = side === 0 ? cross >= 0 && cross <= size : cross >= viewport - size && cross <= viewport;
            if (!inEdge) {
              manager.fail();
              return;
            }
            startMainSv.value = pickMain(touch.x, touch.y);
            startCrossSv.value = pickCross(touch.x, touch.y);
          })
          .onTouchesMove((event, manager) => {
            'worklet';
            if (draggingSv.value === 1) return;
            const touch = event.allTouches[0];
            if (!touch) return;
            const dMain = pickMain(touch.x, touch.y) - startMainSv.value;
            const dCross = pickCross(touch.x, touch.y) - startCrossSv.value;
            if (dMain * dMain + dCross * dCross >= EDGE_SLOP * EDGE_SLOP) {
              manager.activate();
            }
          });
      } else {
        pan = pan.onTouchesDown((event, manager) => {
          'worklet';
          const touch = event.allTouches[0];
          if (!touch || !canStart()) {
            manager.fail();
            return;
          }
          startMainSv.value = pickMain(touch.x, touch.y);
          startCrossSv.value = pickCross(touch.x, touch.y);
        });

        if (config.type === ACT_LONG_PRESS) {
          pan = pan.activateAfterLongPress(config.minDuration);
        } else if (horizontal) {
          pan = pan.activeOffsetY([-config.distance, config.distance]).failOffsetX([-config.distance, config.distance]);
        } else {
          pan = pan.activeOffsetX([-config.distance, config.distance]).failOffsetY([-config.distance, config.distance]);
        }
      }

      const isLongPress = config.type === ACT_LONG_PRESS;

      return pan
        .maxPointers(1)
        .onStart((event) => {
          'worklet';
          // Anchor is the item under the touch-down point (for longPress the finger is still there).
          const main = isLongPress ? pickMain(event.x, event.y) : startMainSv.value;
          const cross = isLongPress ? pickCross(event.x, event.y) : startCrossSv.value;
          touchMainSv.value = pickMain(event.x, event.y);
          touchCrossSv.value = pickCross(event.x, event.y);

          if (!beginDrag(main, cross, id)) return;
          updateDrag(false);
          updateAutoScrollDirection();
        })
        .onUpdate((event) => {
          'worklet';
          if (ownerSv.value !== id) return;
          touchMainSv.value = pickMain(event.x, event.y);
          touchCrossSv.value = pickCross(event.x, event.y);
          updateDrag(false);
          updateAutoScrollDirection();
        })
        .onFinalize(() => {
          'worklet';
          finishDrag(id);
        });
    };

    const pans = activations.map((config, id) => makePan(config, id));
    return pans.length === 1 ? pans[0]! : Gesture.Race(...pans);
  }, [
    activations,
    beginDrag,
    draggingSv,
    enabledSv,
    finishDrag,
    horizontal,
    listCrossSv,
    ownerSv,
    selectionModeSv,
    startCrossSv,
    startMainSv,
    touchCrossSv,
    touchMainSv,
    updateAutoScrollDirection,
    updateDrag,
    viewportCrossSv,
  ]);

  // ---------- list props ----------
  // ---------- LegendList: positions come from its state ----------
  // LegendList has no CellRendererComponent, but it knows every item's position.
  const viewportCrossRef = useRef(0);
  const legendModeSv = useSharedValue(0);
  const legendUnsubscribeRef = useRef<(() => void) | null>(null);
  const legendRafRef = useRef<number | null>(null);

  const syncFromLegendList = useCallback(() => {
    const state = listInstanceRef.current?.getState?.();
    if (!state || typeof state.positionAtIndex !== 'function') return;

    const list = dataRef.current;
    const columns = Math.max(1, numColumnsRef.current);
    // Only items near the viewport (LegendList buffer + margin).
    const from = typeof state.startBuffered === 'number' ? Math.max(0, state.startBuffered - LEGEND_MARGIN) : 0;
    const to =
      typeof state.endBuffered === 'number' ? Math.min(list.length - 1, state.endBuffered + LEGEND_MARGIN) : list.length - 1;
    const crossSize = viewportCrossRef.current / columns;
    const next: LayoutEntry[] = [];

    for (let index = from; index <= to; index += 1) {
      const position = state.positionAtIndex(index);
      if (typeof position !== 'number') continue;
      let size = state.sizeAtIndex(index);
      if (typeof size !== 'number') {
        const nextPosition = state.positionAtIndex(index + 1);
        if (typeof nextPosition !== 'number' || nextPosition <= position) continue;
        size = nextPosition - position;
      }
      const column = index % columns;
      next.push({
        index,
        key: latest.current.keyExtractor(list[index]!, index),
        mainStart: position,
        mainEnd: position + size,
        crossStart: columns > 1 ? column * crossSize : 0,
        crossEnd: columns > 1 ? (column + 1) * crossSize : viewportCrossRef.current || Number.MAX_SAFE_INTEGER,
      });
    }
    entriesRef.current = new Map(next.map((entry) => [entry.index, entry]));
    entriesSv.value = next;
  }, [entriesSv]);

  const scheduleLegendSync = useCallback(() => {
    if (legendRafRef.current !== null) return;
    legendRafRef.current = requestAnimationFrame(() => {
      legendRafRef.current = null;
      syncFromLegendList();
    });
  }, [syncFromLegendList]);

  const attachLegendList = useCallback(() => {
    if (legendUnsubscribeRef.current) return;
    const state = listInstanceRef.current?.getState?.();
    if (!state || typeof state.listen !== 'function' || typeof state.positionAtIndex !== 'function') return;
    legendUnsubscribeRef.current = state.listen('lastPositionUpdate', scheduleLegendSync);
    legendModeSv.value = 1;
    scheduleLegendSync();
  }, [scheduleLegendSync]);

  useEffect(() => {
    if (legendUnsubscribeRef.current) scheduleLegendSync();
  }, [data, numColumns, scheduleLegendSync]);

  // Scroll moved — refresh the geometry window on the UI thread.
  // LegendList also measures new items, and its signal doesn't always fire.
  const onScrollBucket = useCallback((scroll: number) => {
    jsScrollRef.current = scroll;
    if (legendUnsubscribeRef.current) scheduleLegendSync();
    else if (entriesRef.current.size > WINDOW_MIN_ENTRIES) pushEntries();
  }, [pushEntries, scheduleLegendSync]);

  Reanimated.useAnimatedReaction(
    () => {
      const step = legendModeSv.value === 1 ? 100 : Math.max(100, viewportMainSv.value / 2);
      return Math.floor(scrollSv.value / step);
    },
    (bucket, previous) => {
      if (previous !== null && bucket !== previous) {
        runOnJS(onScrollBucket)(scrollSv.value);
      }
    },
    // No dependency array: it's ignored on native (Reanimated 4.7+ warns about it),
    // and onScrollBucket is stable.
  );

  useEffect(
    () => () => {
      legendUnsubscribeRef.current?.();
      legendUnsubscribeRef.current = null;
      if (legendRafRef.current !== null) cancelAnimationFrame(legendRafRef.current);
    },
    [],
  );

  const onListLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { x, y, width, height } = event.nativeEvent.layout;
      const h = horizontalRef.current;
      listMainSv.value = h ? x : y;
      listCrossSv.value = h ? y : x;
      viewportMainSv.value = h ? width : height;
      viewportCrossSv.value = h ? height : width;
      viewportCrossRef.current = h ? height : width;
      jsViewportRef.current = h ? width : height;
      // Some lists don't have their inner ScrollView ready at ref time — finish attaching here.
      attachScrollNode();
      attachLegendList();
      if (legendUnsubscribeRef.current) scheduleLegendSync();
    },
    [attachLegendList, attachScrollNode, listCrossSv, listMainSv, scheduleLegendSync, viewportCrossSv, viewportMainSv],
  );

  const onContentSizeChange = useCallback(
    (width: number, height: number) => {
      contentMainSv.value = horizontalRef.current ? width : height;
    },
    [contentMainSv],
  );

  // Stable cell component: created once, otherwise the list would remount every cell.
  const onCellLayoutRef = useRef(onCellLayout);
  onCellLayoutRef.current = onCellLayout;

  const CellRendererComponent = useMemo(() => {
    const Cell = forwardRef<View, any>(function SwipeSelectCell(props, ref) {
      const { index, onLayout, item, cellKey: _cellKey, ...rest } = props;
      const handleLayout = (event: LayoutChangeEvent) => {
        onLayout?.(event);
        if (typeof index === 'number') {
          onCellLayoutRef.current(index, event.nativeEvent.layout, Array.isArray(item));
        }
      };
      return <View ref={ref} {...rest} onLayout={handleLayout} />;
    });
    return Cell;
  }, []);

  const listProps = useMemo<SwipeSelectListProps>(
    () => ({
      ref: setListInstance,
      onLayout: onListLayout,
      onContentSizeChange,
      scrollEnabled: !isDragging,
      scrollEventThrottle: 16,
      CellRendererComponent,
    }),
    [CellRendererComponent, isDragging, onContentSizeChange, onListLayout, setListInstance],
  );

  // ---------- public API ----------
  const isSelected = useCallback((key: SelectionKey) => selectedRef.current.has(key), [commit, selectedRef]);

  const toggle = useCallback(
    (key: SelectionKey) => {
      const next = new Set(selectedRef.current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      commit(next, 'toggle');
    },
    [commit, selectedRef],
  );

  const select = useCallback(
    (keys: SelectionKey | readonly SelectionKey[]) => {
      const next = new Set(selectedRef.current);
      for (const key of toArray(keys)) next.add(key);
      commit(next, 'api');
    },
    [commit, selectedRef],
  );

  const deselect = useCallback(
    (keys: SelectionKey | readonly SelectionKey[]) => {
      const next = new Set(selectedRef.current);
      for (const key of toArray(keys)) next.delete(key);
      commit(next, 'api');
    },
    [commit, selectedRef],
  );

  const setSelection = useCallback(
    (keys: readonly SelectionKey[]) => commit(new Set(keys), 'api'),
    [commit, selectedRef],
  );

  const selectAll = useCallback(() => {
    const next = new Set<SelectionKey>();
    const list = dataRef.current;
    for (let index = 0; index < list.length; index += 1) {
      if (isSelectableIndex(index)) next.add(latest.current.keyExtractor(list[index]!, index));
    }
    commit(next, 'api');
  }, [commit, isSelectableIndex]);

  const getSelectedIndices = useCallback(() => {
    const result: number[] = [];
    const list = dataRef.current;
    const current = selectedRef.current;
    if (current.size === 0) return result;
    for (let index = 0; index < list.length; index += 1) {
      if (current.has(latest.current.keyExtractor(list[index]!, index))) result.push(index);
    }
    return result;
  }, [selectedRef]);

  const getSelectedItems = useCallback(
    () => getSelectedIndices().map((index) => dataRef.current[index]!),
    [getSelectedIndices],
  );

  const clear = useCallback(() => commit(new Set(), 'api'), [commit, selectedRef]);

  return {
    selectedKeys: selected,
    selectedCount,
    isSelectionMode,
    isDragging,
    isSelected,
    getSelectedItems,
    getSelectedIndices,
    toggle,
    select,
    deselect,
    setSelection,
    selectAll,
    clear,
    listProps,
    onItemLayout,
    autoScrollDirection: autoScrollDirectionSv,
    gesture,
  };
};
