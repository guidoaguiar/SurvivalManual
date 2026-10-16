import { useCallback, useRef } from 'react';
import { BackHandler, Platform } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useReading } from '@/store/reading';
import { toc, tocBySlug } from '@/toc';

// Not <Redirect>: that re-fires on every focus, so Back from the first chapter (which lands here)
// would bounce straight back to it and the app could never be left with Back.
export default function Index() {
  const redirected = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (redirected.current && Platform.OS === 'android') {
        BackHandler.exitApp();
        return;
      }
      redirected.current = true;
      const last = useReading.getState().last;
      const slug = last && tocBySlug.has(last.slug) ? last.slug : toc[0].slug;
      router.replace(`/chapter/${slug}`);
    }, []),
  );
  return null;
}
