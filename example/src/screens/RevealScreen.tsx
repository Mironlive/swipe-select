import React, { useCallback, useMemo } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { SwipeSelectContainer, useSwipeSelect } from '@mironlive/react-native-swipe-select';
import { makeMails, type Mail } from '../data';
import { MailRow, Toolbar, styles } from '../ui';

const keyExtractor = (item: Mail) => item.id;

/**
 * Like iOS Mail:
 * 1. No checkboxes at first.
 * 2. Long press anywhere on an email — selection mode turns on, the email is selected.
 * 3. Drag along the checkbox column to select / deselect emails.
 * 4. Deselect everything — checkboxes hide again.
 */
export const RevealScreen = () => {
  const data = useMemo(() => makeMails(300), []);

  const selection = useSwipeSelect({
    data,
    keyExtractor,
    activation: [
      { type: 'longPress', when: 'idle', minDuration: 350 }, // only outside selection mode
      { type: 'edge', side: 'left', size: 56 }, // in selection mode — along the checkbox column
    ],
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
        showCheckbox={isSelectionMode}
        onPress={onPress}
        onCheckboxPress={toggle}
      />
    ),
    [isSelectionMode, onPress, selectedKeys, toggle],
  );

  // What exactly is selected: keys + the objects themselves.
  const picked = selection.getSelectedItems();

  return (
    <View style={{ flex: 1 }}>
      <Toolbar
        count={selection.selectedCount}
        onSelectAll={selection.selectAll}
        onClear={selection.clear}
        hint="Hold any email → checkboxes appear → drag along the checkbox column."
      />
      <Text style={{ fontSize: 11, color: '#555', paddingHorizontal: 12, paddingBottom: 4 }} numberOfLines={1}>
        {picked.length ? `Selected: ${picked.map((m) => m.subject).join(', ')}` : 'Nothing selected'}
      </Text>
      <SwipeSelectContainer selection={selection}>
        <FlatList
          {...selection.listProps}
          data={data}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          extraData={selectedKeys}
        />
        {isSelectionMode ? <View pointerEvents="none" style={[styles.edgeStrip, { left: 0 }]} /> : null}
      </SwipeSelectContainer>
      {isSelectionMode ? (
        <Pressable onPress={selection.clear} style={{ padding: 12, backgroundColor: '#2f6bff' }}>
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>
            Done ({selection.selectedCount})
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
};
