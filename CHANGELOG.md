# Changelog

## 0.1.0 — unreleased

First public release.

- `useSwipeSelect` hook + `SwipeSelectContainer` + `SwipeSelectFlatList`
- Activation: `edge` (left / right), `longPress`, `pan`; combine several in an array with a `when` condition (`always` / `selectionMode` / `idle`)
- Lists: FlatList, FlashList v2, LegendList; grids (`numColumns`), horizontal and `inverted` lists
- Variable item sizes: real per-item layout + binary search on the UI thread
- `isItemSelectable`, `selectionMode`, `enabled`
- `onSelectionChange` (once per gesture), `onDragStart`, `onItemEnter`, `onDragEnd`
- `toggle` / `select` / `deselect` / `setSelection` / `selectAll` / `clear`, `getSelectedItems()`, `getSelectedIndices()`
- Auto-scroll: speed ramps up towards the edge, frame-rate independent, never overshoots the content; runs only during a gesture
- Moving back restores the selection that existed when the gesture started
- Data changes mid-gesture are remapped by key
- Geometry window on the UI thread — scales to 10k+ items
- No `onScroll` needed: the scroll offset is read via `useScrollOffset`
- Taps are left to your `onPress` — no double toggles
- Ships TypeScript sources for Metro (`react-native` export condition) and a compiled `lib` for everything else
- Supports Reanimated 3 and 4, Gesture Handler 2 and 3, Expo (Expo Go, SDK 58)
- Tested on iOS and Android
