import { useLayoutEffect, type ReactNode } from 'react';
import { useNavigation } from 'expo-router';

export function useTitle(title: string, headerRight?: () => ReactNode) {
  const navigation = useNavigation();
  useLayoutEffect(() => {
    navigation.setOptions({ title, headerRight });
  }, [navigation, title, headerRight]);
}
