import { useCallback, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { lastChapterHref } from '@/lib/nav';

// Launch route: always redirects to the last chapter. Not <Redirect>, because on Android, Back from the
// launch chapter pops the drawer history to just [index] and must leave the app instead of bouncing.
// Only launch reaches index (code never navigates to '/', see lastChapterHref), so it stays history[0].
export default function Index() {
  const navigation = useNavigation();
  const launched = useRef(false);
  useFocusEffect(
    useCallback(() => {
      const backedOut = launched.current && navigation.getState()?.history?.length === 1;
      launched.current = true;
      // exitApp only backgrounds the task (JS keeps running), so still redirect: a resume shows the chapter.
      if (backedOut && Platform.OS === 'android') BackHandler.exitApp();
      router.replace(lastChapterHref());
    }, [navigation]),
  );
  return null;
}
