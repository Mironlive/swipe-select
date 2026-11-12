import type { ComponentType, ReactNode } from 'react';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import type { ComposedGesture, GestureType } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';

/** Item key. The same value your list's `keyExtractor` returns. */
export type SelectionKey = string;

/** What the current gesture does: selects items or deselects them. */
export type DragMode = 'select' | 'deselect';

/** Where a selection change came from. */
export type SelectionChangeReason = 'gesture' | 'toggle' | 'api' | 'sync';

/**
 * Start the gesture from a strip along the list edge (like mail apps).
 * Dragging inside the strip selects; outside of it the list scrolls as usual.
 */
export type EdgeActivation = {
  type: 'edge';
  /** Which edge the strip is on. Default: `'left'`. */
  side?: 'left' | 'right';
  /** Strip width (height for horizontal lists), px. Default: `56`. */
  size?: number;
  /** When this activation is available. Default: `'selectionMode'`. */
  when?: ActivationWhen;
};

/**
 * Start the gesture by long-pressing any item (like Photos or Gmail).
 * Until the finger is held, the list scrolls as usual.
 */
export type LongPressActivation = {
  type: 'longPress';
  /** Hold duration, ms. Default: `300`. */
  minDuration?: number;
  /** When this activation is available. Default: `'always'` — the gesture enters selection mode by itself. */
  when?: ActivationWhen;
};

/**
 * Start the gesture by swiping across the list (like iOS Photos in select mode).
 * Moving along the list scrolls, moving across it selects.
 */
export type PanActivation = {
  type: 'pan';
  /** How far the finger must move across the list to start, px. Default: `10`. */
  activationDistance?: number;
  /** When this activation is available. Default: `'selectionMode'`. */
  when?: ActivationWhen;
};

export type SwipeSelectActivation = EdgeActivation | LongPressActivation | PanActivation;

/**
 * When an activation is available:
 * - `'always'` — always;
 * - `'selectionMode'` — only in selection mode (something is selected, or `selectionMode: true`);
 * - `'idle'` — only outside selection mode. Handy to let a long press enter the mode and the edge strip take over afterwards.
 */
export type ActivationWhen = 'always' | 'selectionMode' | 'idle';

export type AutoScrollConfig = {
  /** Size of the zone near the edge that triggers auto-scroll, px. Default: `60`. */
  edgeSize?: number;
  /** Maximum speed, reached at the very edge, px/s. Default: `900`. */
  maxSpeed?: number;
  /** Minimum speed, at the inner border of the zone, px/s. Default: `120`. */
  minSpeed?: number;
};

export type DragStartEvent = {
  key: SelectionKey;
  index: number;
  mode: DragMode;
};

export type ItemEnterEvent = {
  key: SelectionKey;
  index: number;
  mode: DragMode;
  /** The list is auto-scrolling right now. */
  isAutoScrolling: boolean;
};

export type DragEndEvent = {
  selectedKeys: SelectionKey[];
  mode: DragMode;
};

export type UseSwipeSelectOptions<T> = {
  /** The same data you pass to the list. */
  data: readonly T[] | null | undefined;
  /** The same `keyExtractor` you pass to the list. */
  keyExtractor: (item: T, index: number) => SelectionKey;

  /**
   * External selection state (Redux, Zustand, useState...).
   * The hook syncs with it whenever it changes.
   * During a gesture the hook tracks selection itself and reports the result
   * through `onSelectionChange` when the gesture ends.
   */
  selectedKeys?: readonly SelectionKey[] | ReadonlySet<SelectionKey>;
  /** Initial selection when `selectedKeys` is not provided. */
  defaultSelectedKeys?: readonly SelectionKey[];
  /**
   * Selection changed: gesture ended, `toggle`, `select`, `clear`, etc.
   * Not called on every frame during a gesture — once, when it ends.
   */
  onSelectionChange?: (selectedKeys: SelectionKey[], reason: SelectionChangeReason) => void;

  /** Whether an item can be selected. Non-selectable items are skipped while swiping. */
  isItemSelectable?: (item: T, index: number) => boolean;

  /**
   * How the gesture starts. Default: `{ type: 'edge', side: 'left', size: 56 }`.
   * Pass an array to combine several:
   * `[{ type: 'longPress', when: 'idle' }, { type: 'edge' }]`.
   */
  activation?: SwipeSelectActivation | readonly SwipeSelectActivation[];
  /**
   * Selection mode. Default: on while something is selected.
   * Pass it explicitly if your app toggles the mode with a "Select" button.
   */
  selectionMode?: boolean;
  /** Turn the gesture off entirely. Default: `true`. */
  enabled?: boolean;

  /** Horizontal list. Default: `false`. */
  horizontal?: boolean;
  /** Inverted list (`inverted`, chats). Default: `false`. */
  inverted?: boolean;
  /**
   * Number of columns for `FlatList` with `numColumns`.
   * Not needed for FlashList / LegendList — there every cell is one item.
   */
  numColumns?: number;

  /** Auto-scroll near the edges. `false` turns it off. */
  autoScroll?: boolean | AutoScrollConfig;

  /** The gesture started. */
  onDragStart?: (event: DragStartEvent) => void;
  /** The finger moved onto a new item. Handy for haptics. */
  onItemEnter?: (event: ItemEnterEvent) => void;
  /** The gesture ended. */
  onDragEnd?: (event: DragEndEvent) => void;
};

/** Item geometry in list content coordinates. */
export type ItemLayout = {
  index: number;
  key: SelectionKey;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SwipeSelectListProps = {
  /** Callback ref. Need your own ref too? Call both: `ref={(r) => { selection.listProps.ref(r); myRef.current = r; }}` */
  ref: (instance: any) => void;
  onLayout: (event: LayoutChangeEvent) => void;
  onContentSizeChange: (width: number, height: number) => void;
  scrollEnabled: boolean;
  scrollEventThrottle: number;
  CellRendererComponent: ComponentType<any>;
};

export type UseSwipeSelectResult<T = unknown> = {
  /** Current selection. A new object on every change — safe to pass as `extraData`. */
  selectedKeys: ReadonlySet<SelectionKey>;
  selectedCount: number;
  /** Selection mode is on. */
  isSelectionMode: boolean;
  /** A finger is dragging a selection right now. */
  isDragging: boolean;

  isSelected: (key: SelectionKey) => boolean;
  /** Selected items as objects from `data`, in list order. */
  getSelectedItems: () => T[];
  /** Indices of selected items in `data`, ascending. */
  getSelectedIndices: () => number[];
  toggle: (key: SelectionKey) => void;
  select: (keys: SelectionKey | readonly SelectionKey[]) => void;
  deselect: (keys: SelectionKey | readonly SelectionKey[]) => void;
  setSelection: (keys: readonly SelectionKey[]) => void;
  selectAll: () => void;
  clear: () => void;

  /** Props for your list: `<FlatList {...selection.listProps} />`. */
  listProps: SwipeSelectListProps;
  /**
   * Register item geometry manually when you use your own `CellRendererComponent`.
   * Coordinates are relative to the list content.
   */
  onItemLayout: (layout: ItemLayout) => void;
  /** On-screen auto-scroll direction: -1 towards the top (left), 0, 1 towards the bottom. For highlighting zones. */
  autoScrollDirection: SharedValue<number>;
  /**
   * The gesture itself — if you don't use `SwipeSelectContainer`.
   * Attach it to a View whose direct child is the list.
   */
  gesture: GestureType | ComposedGesture;
};

export type SwipeSelectContainerProps = {
  selection: UseSwipeSelectResult<any>;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};
