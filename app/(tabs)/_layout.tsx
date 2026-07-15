import { Tabs, router } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, font } from '../../constants/theme';

const TABS = [
  { name: 'index',    icon: '🏠', label: 'Home'     },
  { name: 'chats',   icon: '💬', label: 'Chats'    },
  // FAB slot sits here in the middle
  { name: 'activity', icon: '⚡', label: 'Activity' },
  { name: 'profile',  icon: '👤', label: 'Profile'  },
];

function CustomTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();

  const tabItems = TABS.map((tab, idx) => {
    const route = state.routes.find((r: any) => r.name === tab.name);
    const isFocused = route ? state.index === state.routes.indexOf(route) : false;

    const onPress = () => {
      if (!route) return;
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!isFocused && !event.defaultPrevented) navigation.navigate(tab.name);
    };

    return (
      <TouchableOpacity key={tab.name} onPress={onPress} style={styles.tab} activeOpacity={0.7}>
        <Text style={[styles.icon, isFocused && styles.iconActive]}>{tab.icon}</Text>
        <Text style={[styles.label, isFocused && styles.labelActive]}>{tab.label}</Text>
      </TouchableOpacity>
    );
  });

  // Splice FAB into middle position (after Chats)
  tabItems.splice(2, 0, (
    <TouchableOpacity
      key="fab"
      style={styles.fab}
      onPress={() => router.push('/composer')}
      activeOpacity={0.85}
    >
      <Text style={styles.fabIcon}>+</Text>
    </TouchableOpacity>
  ));

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {tabItems}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs tabBar={(props) => <CustomTabBar {...props} />}>
      <Tabs.Screen name="index"    options={{ title: 'Home' }} />
      <Tabs.Screen name="chats"    options={{ title: 'Chats' }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity' }} />
      <Tabs.Screen name="profile"  options={{ title: 'Profile' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
    paddingVertical: 4,
  },
  icon: { fontSize: 20, opacity: 0.45 },
  iconActive: { opacity: 1 },
  label: {
    fontFamily: font.bodySemi,
    fontSize: 10.5,
    color: colors.navInactive,
  },
  labelActive: {
    color: colors.primary,
    fontFamily: font.bodyBold,
  },
  fab: {
    width: 54, height: 54,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
    shadowColor: colors.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.38,
    shadowRadius: 14,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 28,
    color: '#fff',
    fontWeight: '700',
    lineHeight: 32,
  },
});
