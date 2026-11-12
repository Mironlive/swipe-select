import React, { useCallback, useMemo, useState } from 'react';
import { Dimensions, FlatList, Pressable, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SwipeSelectContainer, useSwipeSelect } from '@mironlive/react-native-swipe-select';
import { makePhotos, type Photo } from '../data';
import { Toolbar } from '../ui';

const WIDTH = Dimensions.get('window').width;
const COLUMN_OPTIONS = [2, 3, 4, 6];
const keyExtractor = (item: Photo) => item.id;

/**
 * A gallery like Photos:
 * - long press a photo — selection mode + the photo is selected, keep dragging;
 * - in selection mode a sideways swipe selects, a vertical one scrolls;
 * - 10,000 photos, the number of columns can be changed.
 */
export const GridScreen = ({ list }: { list: 'flatlist' | 'flashlist' }) => {
  const data = useMemo(() => makePhotos(10000), []);
  const [columns, setColumns] = useState(4);

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', gap: 6, padding: 8, alignItems: 'center' }}>
        <Text style={{ fontSize: 12, color: '#555' }}>Columns:</Text>
        {COLUMN_OPTIONS.map((n) => (
          <Pressable
            key={n}
            testID={`cols-${n}`}
            onPress={() => setColumns(n)}
            style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, backgroundColor: n === columns ? '#2f6bff' : '#dfe5f2' }}
          >
            <Text style={{ color: n === columns ? '#fff' : '#2f3b55' }}>{n}</Text>
          </Pressable>
        ))}
      </View>
      {/* numColumns changes require a remount — FlatList/FlashList themselves require it */}
      <Grid key={columns} list={list} data={data} columns={columns} />
    </View>
  );
};

const Grid = ({ list, data, columns }: { list: 'flatlist' | 'flashlist'; data: Photo[]; columns: number }) => {
  const size = Math.floor(WIDTH / columns);

  const selection = useSwipeSelect({
    data,
    keyExtractor,
    numColumns: columns,
    activation: [
      { type: 'longPress', when: 'idle' },
      { type: 'pan', when: 'selectionMode' },
    ],
  });

  const { selectedKeys, toggle, isSelectionMode } = selection;

  const renderItem = useCallback(
    ({ item }: { item: Photo }) => {
      const on = selectedKeys.has(item.id);
      return (
        <Pressable onPress={() => isSelectionMode && toggle(item.id)} style={{ width: size, height: size, padding: 1 }}>
          <View style={{ flex: 1, backgroundColor: item.color, opacity: on ? 0.45 : 1 }} />
          {on ? (
            <View
              style={{
                position: 'absolute',
                right: 6,
                bottom: 6,
                width: 20,
                height: 20,
                borderRadius: 10,
                backgroundColor: '#2f6bff',
                borderWidth: 2,
                borderColor: '#fff',
              }}
            />
          ) : null}
        </Pressable>
      );
    },
    [isSelectionMode, selectedKeys, size, toggle],
  );

  const ListComponent: any = list === 'flashlist' ? FlashList : FlatList;

  return (
    <View style={{ flex: 1 }}>
      <Toolbar
        count={selection.selectedCount}
        onSelectAll={selection.selectAll}
        onClear={selection.clear}
        hint="Hold a photo → selection mode. Then swipe sideways to select, vertically to scroll."
      />
      <SwipeSelectContainer selection={selection}>
        <ListComponent
          {...selection.listProps}
          data={data}
          numColumns={columns}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          extraData={selectedKeys}
        />
      </SwipeSelectContainer>
    </View>
  );
};
