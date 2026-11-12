# Swipe Select

`@mironlive/react-native-swipe-select` · [English](./README.md)

Выбор элементов списка жестом для React Native: зажал → провёл пальцем → элементы под пальцем отмечаются, у края список сам прокручивается.

- `FlatList`, `FlashList` v2, `LegendList`, сетки (`numColumns`), горизонтальные и `inverted`-списки
- три способа начать жест: полоса у края, долгое нажатие, свайп поперёк
- автоскролл у краёв, скорость растёт к краю и не зависит от 60/120 Гц
- движение назад откатывает выбор к исходному состоянию — «мусор» не копится
- невыбираемые элементы (`isItemSelectable`)
- работает со своим стейтом: `useState`, Redux, Zustand
- без UI: чекбоксы, подсветку, счётчик рисуешь сам
- расчёты во время жеста — на UI-потоке (Reanimated worklets), React перерисовывается не чаще раза за кадр

## Установка

```bash
npm i @mironlive/react-native-swipe-select
```

Нужны (скорее всего уже стоят):

```bash
npm i react-native-gesture-handler react-native-reanimated
```

| Пакет | Версия |
| --- | --- |
| `react-native` | ≥ 0.74 (проверено на 0.80, 0.85, 0.88) |
| `react-native-gesture-handler` | ≥ 2.14, включая 3.x (проверено на 2.27, 2.31, 3.3) |
| `react-native-reanimated` | ≥ 3.6 (проверено на 3.18, 4.3, 4.7) |

### Expo

Работает в Expo Go и в dev build — своего нативного кода у пакета нет. Проверено на Expo SDK 58 (RN 0.88, Gesture Handler 3.3, Reanimated 4.7).

```bash
npx expo install react-native-gesture-handler react-native-reanimated
npm i @mironlive/react-native-swipe-select
```

Babel-плагин в Expo подключать не нужно — он уже в `babel-preset-expo`.

Приложение должно быть обёрнуто в `GestureHandlerRootView`, Babel-плагин Reanimated подключён — как в их документации.

## Быстрый старт

```tsx
import { FlatList } from 'react-native';
import { SwipeSelectContainer, useSwipeSelect } from '@mironlive/react-native-swipe-select';

const keyExtractor = (item: Mail) => item.id;

export const Inbox = ({ mails }: { mails: Mail[] }) => {
  const selection = useSwipeSelect({ data: mails, keyExtractor });

  return (
    <SwipeSelectContainer selection={selection}>
      <FlatList
        {...selection.listProps}
        data={mails}
        keyExtractor={keyExtractor}
        extraData={selection.selectedKeys}
        renderItem={({ item }) => (
          <MailRow
            mail={item}
            checked={selection.selectedKeys.has(item.id)}
            onCheckboxPress={() => selection.toggle(item.id)}
          />
        )}
      />
    </SwipeSelectContainer>
  );
};
```

Три правила:

1. `{...selection.listProps}` — в список. Через них хук узнаёт позиции строк и управляет скроллом.
2. Список — **прямой потомок** `SwipeSelectContainer`.
3. `data` и `keyExtractor` — те же, что у списка.

По умолчанию: первый элемент отмечаешь тапом по своему чекбоксу → включается режим выбора → ведёшь пальцем по левой полосе шириной 56px.

## Как начинается жест — `activation`

```tsx
// Полоса у края (по умолчанию). Как в почтовых клиентах.
activation: { type: 'edge', side: 'left', size: 56 }

// Долгое нажатие на любой элемент. Как в Gmail / галерее. Режим выбора не нужен.
activation: { type: 'longPress', minDuration: 300 }

// Свайп поперёк списка. Как «Фото» iOS: по горизонтали — выделение, по вертикали — скролл.
activation: { type: 'pan', activationDistance: 10 }
```

| | `edge` | `longPress` | `pan` |
| --- | --- | --- | --- |
| Где | полоса у края | весь элемент | весь элемент |
| Старт | сдвиг пальца на 4px | удержание | сдвиг поперёк списка |
| `when` по умолчанию | `'selectionMode'` | `'always'` | `'selectionMode'` |
| Скролл | вне полосы | до удержания | вдоль списка |

`when` — когда способ доступен: `'always'`, `'selectionMode'` (только в режиме выбора), `'idle'` (только вне режима).

### Несколько способов сразу

`activation` принимает массив. Как в iOS Mail — чекбоксов не видно, long press в любом месте письма включает режим и отмечает его, дальше ведёшь по колонке чекбоксов:

```tsx
activation: [
  { type: 'longPress', when: 'idle' },   // вне режима выбора
  { type: 'edge', side: 'left' },        // в режиме выбора
]
```

Галерея как в «Фото» без кнопки «Выбрать»:

```tsx
activation: [
  { type: 'longPress', when: 'idle' },   // удержал фото — режим + можно сразу вести
  { type: 'pan' },                       // в режиме: по горизонтали выделение, по вертикали скролл
]
```

Прятать чекбоксы вне режима — это твой UI: `showCheckbox={selection.isSelectionMode}`.

**Режим выбора** по умолчанию включён, когда что-то выбрано. Если у тебя кнопка «Выбрать» — передай `selectionMode={isSelecting}`.

**Тап** жест не обрабатывает: тап в полосе достаётся твоему `onPress`. Драг — жесту. Двойного срабатывания нет.

## Свой стейт (Redux, Zustand...)

```tsx
const selectedIds = useAppSelector((s) => s.mail.selectedIds);
const dispatch = useAppDispatch();

const selection = useSwipeSelect({
  data: mails,
  keyExtractor,
  selectedKeys: selectedIds,
  onSelectionChange: (ids) => dispatch(setSelectedIds(ids)),
});
```

- `selectedKeys` меняется снаружи — хук подхватывает.
- Во время жеста выбор живёт внутри хука и рендерится раз в кадр. Наружу — один `onSelectionChange` в конце жеста, а не 60 диспатчей в секунду.
- `toggle`, `select`, `deselect`, `selectAll`, `clear` тоже вызывают `onSelectionChange`.

Без внешнего стейта — просто не передавай `selectedKeys`; начальный выбор — `defaultSelectedKeys`.

## Разные списки

### FlatList

Обычный `FlatList` из `react-native` — работает как есть.

> ⚠️ **Не `Animated.FlatList` из Reanimated** — он запрещает `CellRendererComponent`, а через него хук узнаёт позиции строк. Если нужен анимированный — бери `SwipeSelectFlatList` из пакета (это `Animated.createAnimatedComponent(FlatList)`). В dev-режиме хук предупредит, если геометрия не приходит.

### FlashList v2

```tsx
import { FlashList } from '@shopify/flash-list';

<FlashList {...selection.listProps} data={data} renderItem={renderItem} />
```

`AnimatedFlashList` тоже подходит.

### Сетка

```tsx
// FlashList: ничего дополнительно не нужно
<FlashList {...selection.listProps} numColumns={4} ... />

// FlatList: передай numColumns и в хук
const selection = useSwipeSelect({ data, keyExtractor, numColumns: 4, activation: { type: 'pan' } });
<FlatList {...selection.listProps} numColumns={4} ... />
```

Выделение в сетке — линейное по индексу, как в «Фото»: от первой ячейки до той, что под пальцем.
У FlatList ячейка — целая строка, колонки считаются равной ширины.

### LegendList

```tsx
import { LegendList } from '@legendapp/list/react-native';

<LegendList {...selection.listProps} data={data} renderItem={renderItem} recycleItems />
```

Ничего дополнительно не нужно: хук сам видит LegendList и берёт позиции элементов из его состояния.

### Перевёрнутый список (чат)

```tsx
const selection = useSwipeSelect({ data, keyExtractor, inverted: true, activation: { type: 'longPress' } });
<FlatList {...selection.listProps} inverted ... />
```

### Горизонтальный список

```tsx
const selection = useSwipeSelect({ data, keyExtractor, horizontal: true, activation: { type: 'longPress' } });
<FlatList {...selection.listProps} horizontal ... />
```

### Свой `CellRendererComponent`

`listProps` содержит свой `CellRendererComponent`. Если нужен свой — сообщай геометрию сам:

```tsx
const MyCell = ({ index, onLayout, ...props }) => (
  <View
    {...props}
    onLayout={(e) => {
      onLayout?.(e);
      const { x, y, width, height } = e.nativeEvent.layout;
      selection.onItemLayout({ index, key: data[index].id, x, y, width, height });
    }}
  />
);

<FlatList {...selection.listProps} CellRendererComponent={MyCell} />
```

Координаты — относительно контента списка.

## Хаптика и события

```tsx
import * as Haptics from 'expo-haptics';

useSwipeSelect({
  ...
  onDragStart: ({ key, mode }) => Haptics.impactAsync(),
  onItemEnter: () => Haptics.selectionAsync(), // палец перешёл на новый элемент
  onDragEnd: ({ selectedKeys, mode }) => {},
});
```

`mode` — `'select'` или `'deselect'`: начал жест на выбранном элементе — жест снимает выбор.

## Подсветка зон и состояние

```tsx
selection.isSelectionMode    // режим выбора
selection.isDragging         // палец ведёт выделение
selection.autoScrollDirection // SharedValue: -1 вверх, 0, 1 вниз — для useAnimatedStyle
```

Внутри `SwipeSelectContainer` поверх списка можно класть свои слои (`pointerEvents="none"`) — например, подсветку полосы.

## API

### `useSwipeSelect(options)`

| Опция | Тип | По умолчанию | |
| --- | --- | --- | --- |
| `data` | `T[]` | — | данные списка |
| `keyExtractor` | `(item, index) => string` | — | ключ элемента |
| `selectedKeys` | `string[] \| Set<string>` | — | внешний стейт |
| `defaultSelectedKeys` | `string[]` | `[]` | начальный выбор без внешнего стейта |
| `onSelectionChange` | `(keys, reason) => void` | — | `reason`: `gesture` / `toggle` / `api` |
| `isItemSelectable` | `(item, index) => boolean` | все | невыбираемые пропускаются |
| `activation` | объект или массив, см. выше | `{ type: 'edge' }` | как начинается жест |
| `selectionMode` | `boolean` | `selectedCount > 0` | режим выбора |
| `enabled` | `boolean` | `true` | выключить жест |
| `horizontal` | `boolean` | `false` | горизонтальный список |
| `inverted` | `boolean` | `false` | перевёрнутый список |
| `numColumns` | `number` | `1` | колонки FlatList и LegendList; для FlashList не нужно |
| `autoScroll` | `boolean \| { edgeSize, maxSpeed, minSpeed }` | `{ 60, 900, 120 }` | px и px/с |
| `onDragStart` | `({ key, index, mode }) => void` | — | |
| `onItemEnter` | `({ key, index, mode, isAutoScrolling }) => void` | — | |
| `onDragEnd` | `({ selectedKeys, mode }) => void` | — | |

Возвращает:

| | |
| --- | --- |
| `selectedKeys` | `ReadonlySet<string>` — новый объект при каждом изменении, годится для `extraData` |
| `selectedCount`, `isSelectionMode`, `isDragging` | |
| `isSelected(key)`, `toggle(key)` | |
| `getSelectedItems()` | выбранные объекты из `data` целиком, в порядке списка |
| `getSelectedIndices()` | индексы выбранных в `data` |
| `select(keys)`, `deselect(keys)`, `setSelection(keys)`, `selectAll()`, `clear()` | |
| `listProps` | пропсы списка: `ref` (callback), `onLayout`, `onContentSizeChange`, `scrollEnabled`, `scrollEventThrottle`, `CellRendererComponent` |
| `onItemLayout(layout)` | ручная регистрация геометрии |
| `autoScrollDirection` | `SharedValue<number>` |
| `gesture` | сам жест — если хочешь свой `GestureDetector` вместо контейнера |

Если в списке нужны свои `ref` / `onLayout` / `onContentSizeChange` — вызови и обработчики из `listProps`:

```tsx
ref={(list) => { selection.listProps.ref(list); myListRef.current = list; }}
onLayout={(e) => { selection.listProps.onLayout(e); myOnLayout(e); }}
```

`onScroll` хуку не нужен — свой `onScroll` передавай как обычно.

## Что хранит выбор

Ключи — строки из твоего `keyExtractor`. Ключом может быть что угодно: `id`, `uuid`, `` `${type}:${id}` ``.
Нужны сами объекты — `selection.getSelectedItems()`, индексы — `getSelectedIndices()`.
В событиях (`onDragStart`, `onItemEnter`) приходят `key` и `index`.

## Производительность

Список остаётся твоим — со своей виртуализацией (`FlatList`, `FlashList`, `LegendList`). Пакет только читает позиции ячеек и смещение скролла.

| Когда | Что делает пакет | Цена |
| --- | --- | --- |
| Покой | ничего: колбэк кадра выключен, жест ждёт касания | ноль |
| Скролл | обновляет окно позиций раз в полэкрана | O(измеренных ячеек), редко |
| Жест, каждый кадр | поиск строки под пальцем (бинарный, UI-поток), шаг автоскролла | ~10 сравнений на 1000 строк |
| Жест, палец перешёл на новую строку | пересчёт диапазона (только разница) + один React-рендер | ~10 раз/с при автоскролле |
| Конец жеста | один `onSelectionChange` | один раз |

Главная цена во время жеста — React-рендер строк при изменении выбора. Её контролируешь ты:

```tsx
// строка — memo, получает boolean, а не весь Set
const MailRow = memo(({ mail, checked, onToggle }: Props) => { ... });

const renderItem = useCallback(
  ({ item }) => <MailRow mail={item} checked={selection.selectedKeys.has(item.id)} onToggle={selection.toggle} />,
  [selection.selectedKeys, selection.toggle],
);
```

- Колбэки в строку — стабильные (`useCallback`), иначе `memo` не сработает.
- Не передавай в строку весь `selectedKeys` — только `checked`.
- Тяжёлые строки (картинки, тени) — `FlashList` / `LegendList` с переиспользованием ячеек.
- Окно геометрии на UI-потоке — ±3–4 экрана вокруг скролла; проверено на 10 000 элементов.

## Как это работает

- Каждая ячейка сообщает свою позицию через `CellRendererComponent` → реестр, отсортированный по индексу. У LegendList позиции берутся из его состояния.
- Касание переводится в координаты контента (`+ scrollOffset`), элемент ищется бинарным поиском прямо в worklet. Разная высота строк, сетки, дыры от виртуализации — всё ок. Палец на разделителе — берётся ближайший элемент.
- Выбор считается как переход между диапазонами `[якорь..палец]`: вошёл в диапазон — применяем режим, вышел — восстанавливаем из снимка на старте жеста. Обрабатывается только разница диапазонов.
- Смещение скролла читается с нативного ScrollView (`useScrollOffset`), прокрутка — `scrollTo` на UI-потоке.
- Если `data` меняется посреди жеста (новое письмо сверху, удаление), якорь и диапазон переносятся по ключам — выделение не съезжает. Если якорный элемент удалили — жест завершается.

## Ограничения

- Порядок индексов должен совпадать с визуальным (обычные списки и сетки). Masonry-раскладки не поддерживаются.
- `SectionList` не поддерживается.
- `horizontal`, `inverted`, `numColumns` меняются на лету только вместе с перемонтированием списка (`key`).
- Проверено в симуляторе iOS и эмуляторе Android: RN 0.80 + Reanimated 3.18, RN 0.85 + Reanimated 4.3, Expo SDK 58 (RN 0.88 + Gesture Handler 3.3 + Reanimated 4.7).

## Example

В `example/` — голое RN-приложение с восемью сценариями: почта с полосой слева (FlatList, недоступные элементы, симуляция входящих писем во время жеста), полоса справа (FlashList), long press, LegendList, чат (`inverted`), сетка FlashList, сетка FlatList, горизонтальный список.

```bash
npm run example:install
npm run example:pods
npm run example:start
npm run example:ios
```

## Разработка

```bash
npm run type-check
npm test        # чистая логика: диапазоны и hit-test
npm run build
```

## Сравнение

| | этот пакет | `@osamaq/drag-select` |
| --- | --- | --- |
| Разная высота элементов | да (реальная геометрия) | нет, фиксированный `itemSize` |
| FlatList / FlashList v2 / LegendList | да / да / да | да / да* / — |
| Сетки, горизонтальные | да | да |
| `inverted` (чаты) | да | нет |
| Активация | полоса, long press, pan, комбинации | long press + pan |
| Невыбираемые элементы | да | — |
| Откат при движении назад | к состоянию на старте жеста | — |
| Внешний стейт, один коллбэк на жест | да | — |
| Изменение `data` во время жеста | перенос по ключам | — |
| Reanimated | 3 и 4 | ≥ 3.16 |

\* по их README: без динамических размеров.

## Автор

Made by Mironov · [@Mironlive](https://github.com/Mironlive)

## Лицензия

MIT
