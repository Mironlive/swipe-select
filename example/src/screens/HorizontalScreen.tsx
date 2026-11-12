import React, { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';
import { SwipeSelectContainer, SwipeSelectFlatList, useSwipeSelect } from '@mironlive/react-native-swipe-select';
import { makePhotos, type Photo } from '../data';
import { Toolbar } from '../ui';

const keyExtractor = (item: Photo) => item.id;

export const HorizontalScreen = () => {
  const data = useMemo(() => makePhotos(80), []);
  const selection = useSwipeSelect({
    data,
    keyExtractor,
    horizontal: true,
    activation: { type: 'longPress' },
  });
  const { selectedKeys } = selection;

  const renderItem = useCallback(
    ({ item, index }: { item: Photo; index: number }) => {
      const on = selectedKeys.has(item.id);
      return (
        <View
          style={{
            width: 70 + (index % 3) * 30,
            height: 140,
            margin: 4,
            borderRadius: 12,
            backgroundColor: item.color,
            borderWidth: 4,
            borderColor: on ? '#2f6bff' : 'transparent',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>{index + 1}</Text>
        </View>
      );
    },
    [selectedKeys],
  );

  return (
    <View style={{ flex: 1 }}>
      <Toolbar
        count={selection.selectedCount}
        onSelectAll={selection.selectAll}
        onClear={selection.clear}
        hint="Horizontal list: long press, then drag left / right"
      />
      <View style={{ height: 170 }}>
        <SwipeSelectContainer selection={selection}>
          <SwipeSelectFlatList
            {...selection.listProps}
            horizontal
            data={data}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            extraData={selectedKeys}
          />
        </SwipeSelectContainer>
      </View>
    </View>
  );
};
