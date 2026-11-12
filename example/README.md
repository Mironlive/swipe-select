# Example

Demo app for `@mironlive/react-native-swipe-select`. The library is linked via `file:..` and read from `../src`, so changes show up instantly with Fast Refresh.

Scenarios (tabs at the top):

| Tab | List | Activation |
| --- | --- | --- |
| Long press → checkboxes | FlatList | long press when idle, then the checkbox strip |
| Mail · edge | FlatList | left strip, every 7th email is locked, "Simulate incoming mail" |
| Right edge · FlashList | FlashList | right strip |
| Long press | FlatList | long press |
| LegendList | LegendList | left strip |
| Chat · inverted | FlatList `inverted` | long press |
| Grid · FlashList | FlashList, 2–6 columns, 10,000 photos | long press, then swipe across |
| Grid · FlatList | FlatList `numColumns` | same |
| Horizontal | FlatList horizontal | long press |

Run from the repository root:

```bash
npm run example:install
npm run example:pods
npm run example:start   # Metro
npm run example:ios     # or: cd example && npm run android
```

Node ≥ 22.11 (required by RN 0.85).

On iOS you can open a specific tab on launch: `xcrun simctl launch booted org.reactjs.native.example.GestureSelectExample -initialTab grid-flash`.
