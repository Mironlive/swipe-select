import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, Settings, StatusBar, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { MailListScreen } from './src/screens/MailListScreen';
import { GridScreen } from './src/screens/GridScreen';
import { RevealScreen } from './src/screens/RevealScreen';
import { HorizontalScreen } from './src/screens/HorizontalScreen';

const SCREENS = [
  { id: 'reveal', title: 'Long press → checkboxes', render: () => <RevealScreen /> },
  {
    id: 'edge',
    title: 'Mail · edge',
    render: () => (
      <MailListScreen
        list="flatlist"
        activation={{ type: 'edge' }}
        withDisabled
        hint="Tap a checkbox → drag along the left strip. Every 7th email is locked."
      />
    ),
  },
  {
    id: 'edge-right',
    title: 'Right edge · FlashList',
    render: () => (
      <MailListScreen
        list="flashlist"
        activation={{ type: 'edge', side: 'right' }}
        hint="FlashList. Selection strip on the right."
      />
    ),
  },
  {
    id: 'long',
    title: 'Long press',
    render: () => (
      <MailListScreen
        list="flatlist"
        activation={{ type: 'longPress' }}
        hint="Hold any email and drag up / down. No selection mode needed."
      />
    ),
  },
  {
    id: 'legend',
    title: 'LegendList',
    render: () => (
      <MailListScreen list="legendlist" activation={{ type: 'edge' }} withDisabled hint="LegendList. Selection strip on the left." />
    ),
  },
  {
    id: 'inverted',
    title: 'Chat · inverted',
    render: () => (
      <MailListScreen
        list="flatlist"
        inverted
        activation={{ type: 'longPress' }}
        hint="Inverted FlatList (chat): #1 is at the bottom. Hold and drag up — auto-scrolls to older ones."
      />
    ),
  },
  { id: 'grid-flash', title: 'Grid · FlashList', render: () => <GridScreen list="flashlist" /> },
  { id: 'grid-flat', title: 'Grid · FlatList', render: () => <GridScreen list="flatlist" /> },
  { id: 'horizontal', title: 'Horizontal', render: () => <HorizontalScreen /> },
];

function App() {
  // Initial tab: xcrun simctl launch <udid> <bundle> -initialTab grid-flash
  const [screen, setScreen] = useState<string>(() => {
    const fromArgs = Platform.OS === 'ios' ? (Settings.get('initialTab') as string | undefined) : undefined;
    return SCREENS.some((s) => s.id === fromArgs) ? fromArgs! : SCREENS[0]!.id;
  });
  const current = SCREENS.find((s) => s.id === screen)!;

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" />
        <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
              {SCREENS.map((s) => (
                <Pressable
                  key={s.id}
                  testID={`tab-${s.id}`}
                  onPress={() => setScreen(s.id)}
                  style={[styles.tab, s.id === screen && styles.tabOn]}
                >
                  <Text style={[styles.tabText, s.id === screen && styles.tabTextOn]}>{s.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
          <View key={current.id} style={styles.root}>
            {current.render()}
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#fff' },
  tabs: { paddingHorizontal: 8, paddingVertical: 8, gap: 6 },
  tab: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, backgroundColor: '#eef0f4' },
  tabOn: { backgroundColor: '#2f6bff' },
  tabText: { color: '#2f3b55', fontSize: 13 },
  tabTextOn: { color: '#fff', fontWeight: '600' },
});

export default App;
