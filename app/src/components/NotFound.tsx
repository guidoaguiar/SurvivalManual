import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { lastChapterHref } from '@/lib/nav';
import { useColors } from '@/theme';
import { Button } from './Button';

export function NotFound({ message }: { message?: string }) {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View style={styles.box}>
      <Text style={[styles.text, { color: colors.text }]}>{message ?? t('chapter_not_found')}</Text>
      <Button label={t('back_to_contents')} onPress={() => router.replace(lastChapterHref())} />
    </View>
  );
}

const styles = StyleSheet.create({ box: { flex: 1, padding: 24, justifyContent: 'center' }, text: { fontSize: 18, textAlign: 'center', marginBottom: 16 } });
