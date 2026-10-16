import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { useColors } from '@/theme';

export function CompassUnavailable() {
  const { t } = useTranslation();
  const colors = useColors();
  return (
    <View style={styles.box}>
      <Text style={[styles.text, { color: colors.text }]}>{t('compass_unavailable')}</Text>
      <Button label={t('compass_learn')} onPress={() => router.push('/chapter/DirectionFinding')} />
    </View>
  );
}

const styles = StyleSheet.create({ box: { flex: 1, padding: 24, justifyContent: 'center' }, text: { fontSize: 18, textAlign: 'center', marginBottom: 16 } });
