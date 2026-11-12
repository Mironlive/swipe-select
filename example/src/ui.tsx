import React, { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Mail } from './data';

export const Checkbox = ({ checked, disabled }: { checked: boolean; disabled?: boolean }) => (
  <View style={[styles.box, checked && styles.boxOn, disabled && styles.boxDisabled]}>
    {checked ? <Text style={styles.tick}>✓</Text> : null}
  </View>
);

type MailRowProps = {
  item: Mail;
  checked: boolean;
  selectionMode: boolean;
  checkboxSide?: 'left' | 'right';
  /** false — the checkbox column is hidden (outside selection mode). */
  showCheckbox?: boolean;
  onPress: (id: string) => void;
  onCheckboxPress: (id: string) => void;
  onLongPress?: (id: string) => void;
};

export const MailRow = memo(
  ({ item, checked, selectionMode, checkboxSide = 'left', showCheckbox = true, onPress, onCheckboxPress, onLongPress }: MailRowProps) => {
    const box = !showCheckbox ? (
      <View style={styles.asideHidden} />
    ) : (
      <Pressable hitSlop={8} onPress={() => onCheckboxPress(item.id)} style={styles.aside} disabled={item.disabled}>
        <Checkbox checked={checked} disabled={item.disabled} />
      </Pressable>
    );
    return (
      <Pressable
        onPress={() => onPress(item.id)}
        onLongPress={onLongPress ? () => onLongPress(item.id) : undefined}
        style={[styles.row, checked && styles.rowOn, item.disabled && styles.rowDisabled]}
      >
        {checkboxSide === 'left' ? box : null}
        <View style={styles.body}>
          <Text style={styles.from}>
            {item.from}
            {item.disabled ? '  · locked' : ''}
          </Text>
          <Text style={styles.subject}>{item.subject}</Text>
          <Text style={styles.preview} numberOfLines={item.lines}>
            {item.preview}
          </Text>
        </View>
        {checkboxSide === 'right' ? box : null}
      </Pressable>
    );
  },
);

export const Toolbar = ({
  count,
  onSelectAll,
  onClear,
  hint,
}: {
  count: number;
  onSelectAll: () => void;
  onClear: () => void;
  hint: string;
}) => (
  <View style={styles.toolbar}>
    <Text style={styles.count} testID="selected-count">
      Selected: {count}
    </Text>
    <Pressable onPress={onSelectAll} style={styles.btn}>
      <Text style={styles.btnText}>All</Text>
    </Pressable>
    <Pressable onPress={onClear} style={styles.btn}>
      <Text style={styles.btnText}>Clear</Text>
    </Pressable>
    <Text style={styles.hint}>{hint}</Text>
  </View>
);

export const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ddd',
  },
  rowOn: { backgroundColor: '#e8f0ff' },
  rowDisabled: { opacity: 0.5 },
  aside: { width: 56, alignItems: 'center', paddingTop: 16 },
  asideHidden: { width: 12 },
  body: { flex: 1, paddingVertical: 12, paddingHorizontal: 12 },
  from: { fontWeight: '600', fontSize: 15, color: '#111' },
  subject: { fontSize: 14, color: '#222', marginTop: 2 },
  preview: { fontSize: 13, color: '#777', marginTop: 4 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#9aa3b2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxOn: { backgroundColor: '#2f6bff', borderColor: '#2f6bff' },
  boxDisabled: { borderColor: '#ccc' },
  tick: { color: '#fff', fontSize: 14, fontWeight: '700' },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#f4f5f7',
    gap: 8,
  },
  count: { fontWeight: '600', fontSize: 15, minWidth: 100 },
  btn: { paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#dfe5f2', borderRadius: 6 },
  btnText: { color: '#2f3b55' },
  hint: { width: '100%', color: '#666', fontSize: 12 },
  edgeStrip: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 56,
    backgroundColor: 'rgba(47,107,255,0.06)',
  },
});
