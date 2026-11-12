import type { ReactElement, Ref } from 'react';
import { FlatList } from 'react-native';
import type { FlatListProps } from 'react-native';
import Animated from 'react-native-reanimated';

/**
 * Animated FlatList compatible with `useSwipeSelect`.
 *
 * Why: Reanimated's `Animated.FlatList` doesn't accept `CellRendererComponent`,
 * which the hook uses to learn row positions. This component is the same as
 * `Animated.createAnimatedComponent(FlatList)`.
 */
export const SwipeSelectFlatList = Animated.createAnimatedComponent(FlatList) as unknown as <T>(
  props: Omit<FlatListProps<T>, 'onScroll'> & { ref?: Ref<any>; onScroll?: any },
) => ReactElement | null;
