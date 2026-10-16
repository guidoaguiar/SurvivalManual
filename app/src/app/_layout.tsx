import { useEffect, useMemo } from 'react';
import { StyleSheet, useWindowDimensions } from 'react-native';
import { Drawer } from 'expo-router/drawer';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import i18n, { pickLanguage } from '@/i18n';
import { importLegacyOnce } from '@/lib/legacyImport';
import { registerServiceWorker } from '@/pwa/register';
import { DrawerContent } from '@/components/DrawerContent';
import { useHydrated } from '@/store/hydration';
import { useSettings } from '@/store/settings';
import { useColors } from '@/theme';

export default function RootLayout() {
  const hydrated = useHydrated();
  const colors = useColors();
  const { width } = useWindowDimensions();
  const language = useSettings((s) => s.language);

  useEffect(() => {
    void i18n.changeLanguage(pickLanguage(language));
  }, [language]);

  useEffect(() => {
    registerServiceWorker();
  }, []);

  // importLegacyOnce is idempotent; running it here guarantees it precedes the first Drawer render.
  const ready = useMemo(() => {
    if (!hydrated) return false;
    importLegacyOnce();
    return true;
  }, [hydrated]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={styles.fill}>
      <StatusBar style="light" />
      <Drawer
        drawerContent={(props) => <DrawerContent navigation={props.navigation} />}
        screenOptions={{
          drawerType: width >= 900 ? 'permanent' : 'front',
          headerStyle: { backgroundColor: colors.primary },
          headerTintColor: colors.onPrimary,
          drawerStyle: { backgroundColor: colors.background, width: 300 },
          sceneStyle: { backgroundColor: colors.background },
        }}
      />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
