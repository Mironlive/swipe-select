import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { LegendList } from '@legendapp/list/react-native';
import {
  SwipeSelectContainer,
  useSwipeSelect,
  type SwipeSelectActivation,
} from '@mironlive/react-native-swipe-select';
import { makeMails, type Mail } from '../data';
import { MailRow, Toolbar, styles } from '../ui';

type Props = {
  list: 'flatlist' | 'flashlist' | 'legendlist';
  activation: SwipeSelectActivation;
  withDisabled?: boolean;
  inverted?: boolean;
  hint: string;
};

const keyExtractor = (item: Mail) => item.id;

export const MailListScreen = ({ list, activation, withDisabled, inverted, hint }: Props) => {
  const initial = useMemo(() => makeMails(300, withDisabled), [withDisabled]);
  const [data, setData] = useState(initial);
  // "Incoming mail": a new email at the top every 1.5 s — checks that the gesture survives shifting indices.
  const [live, setLive] = useState(false);
  useEffect(() => {
    if (!live) return;
    let n = 0;
    const id = setInterval(() => {
      n += 1;
      setData((prev) => [
        { id: `new-${Date.now()}`, from: 'New', subject: `Incoming ${n}`, preview: 'Just arrived', lines: 1 },
        ...prev,
      ]);
    }, 1500);
    return () => clearInterval(id);
  }, [live]);
  // External state — like Redux in a real app.
  const [stored, setStored] = useState<string[]>([]);
  const side = activation.type === 'edge' && activation.side === 'right' ? 'right' : 'left';

  const selection = useSwipeSelect({
    data,
    keyExtractor,
    selectedKeys: stored,
    onSelectionChange: (keys) => setStored(keys),
    isItemSelectable: (item) => !item.disabled,
    activation,
    inverted,
    onItemEnter: () => {
      // Haptics go here: Haptics.selectionAsync() / ReactNativeHapticFeedback.trigger('selection')
    },
  });

  const { toggle, isSelectionMode, selectedKeys } = selection;

  const onPress = useCallback(
    (id: string) => {
      if (isSelectionMode) toggle(id);
    },
    [isSelectionMode, toggle],
  );

  const renderItem = useCallback(
    ({ item }: { item: Mail }) => (
      <MailRow
        item={item}
        checked={selectedKeys.has(item.id)}
        selectionMode={isSelectionMode}
        checkboxSide={side}
        onPress={onPress}
        onCheckboxPress={toggle}
      />
    ),
    [isSelectionMode, onPress, selectedKeys, side, toggle],
  );

  const ListComponent: any = list === 'flashlist' ? FlashList : list === 'legendlist' ? LegendList : FlatList;

  return (
    <View style={{ flex: 1 }}>
      <Toolbar count={selection.selectedCount} onSelectAll={selection.selectAll} onClear={selection.clear} hint={hint} />
      <Pressable onPress={() => setLive((v) => !v)} style={{ paddingVertical: 4, paddingHorizontal: 12 }}>
        <Text style={{ fontSize: 12, color: live ? '#c0392b' : '#2f6bff' }}>
          {live ? '● New mail is arriving — tap to stop' : 'Simulate incoming mail'}
        </Text>
      </Pressable>
      <SwipeSelectContainer selection={selection}>
        <ListComponent
          {...selection.listProps}
          data={data}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          extraData={selectedKeys}
          inverted={inverted}
          {...(list === 'legendlist' ? { recycleItems: true } : null)}
        />
        {isSelectionMode && activation.type === 'edge' ? (
          <View pointerEvents="none" style={[styles.edgeStrip, side === 'right' ? { right: 0 } : { left: 0 }]} />
        ) : null}
      </SwipeSelectContainer>
    </View>
  );
};
