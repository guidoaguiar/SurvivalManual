import { useCallback, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';
import { router, useFocusEffect, useNavigation } from 'expo-router';
import { useReading } from '@/store/reading';
import { toc, tocBySlug } from '@/toc';

// Launch route: always redirects to the last chapter. Not <Redirect>, because on Android, Back from the
// launch chapter pops the drawer history to just [index] and must leave the app instead of bouncing.
// A programmatic replace('/') is a drawer JUMP_TO, which appends index after the current route (history >= 2),
// so it only redirects.
export default function Index() {
  const navigation = useNavigation();
  const launched = useRef(false);
  useFocusEffect(
    useCallback(() => {
      const backedOut = launched.current && navigation.getState()?.history?.length === 1;
      launched.current = true;
      // exitApp only backgrounds the task (JS keeps running), so still redirect: a resume shows the chapter.
      if (backedOut && Platform.OS === 'android') BackHandler.exitApp();
      const last = useReading.getState().last;
      const slug = last && tocBySlug.has(last.slug) ? last.slug : toc[0].slug;
      router.replace(`/chapter/${slug}`);
    }, [navigation]),
  );
  return null;
}
