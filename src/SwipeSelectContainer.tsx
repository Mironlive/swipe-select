import { StyleSheet, View } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import type { SwipeSelectContainerProps } from './types';

/**
 * Wraps the list and attaches the selection gesture.
 * The list must be a direct child — geometry is measured from its `onLayout`.
 * You can render your own overlays inside the container (zone highlights, toolbars).
 */
export const SwipeSelectContainer = ({ selection, style, children }: SwipeSelectContainerProps) => (
  <GestureDetector gesture={selection.gesture}>
    <View style={[styles.root, style]} collapsable={false}>
      {children}
    </View>
  </GestureDetector>
);

const styles = StyleSheet.create({
  root: { flex: 1 },
});
