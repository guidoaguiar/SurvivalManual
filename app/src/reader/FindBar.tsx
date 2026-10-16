import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@/components/IconButton';
import { useColors } from '@/theme';

type Props = { query: string; onChangeQuery: (q: string) => void; total: number; current: number; onPrev: () => void; onNext: () => void; onClose: () => void };

export function FindBar({ query, onChangeQuery, total, current, onPrev, onNext, onClose }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const status = query.trim() ? (total ? t('match_of', { current: current + 1, total }) : t('no_matches')) : '';
  return (
    <View style={[styles.bar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <TextInput
        testID="find-input"
        value={query}
        onChangeText={onChangeQuery}
        placeholder={t('find_in_chapter')}
        placeholderTextColor={colors.muted}
        style={[styles.input, { color: colors.text }]}
        autoFocus={!query}
        returnKeyType="search"
        onSubmitEditing={onNext}
      />
      <Text testID="find-status" style={{ color: colors.muted }}>
        {status}
      </Text>
      <IconButton icon="chevron-up" label={t('previous')} color={colors.text} onPress={onPrev} disabled={!total} />
      <IconButton icon="chevron-down" label={t('next')} color={colors.text} onPress={onNext} disabled={!total} />
      <IconButton icon="close" label={t('close')} color={colors.text} onPress={onClose} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  input: { flex: 1, paddingVertical: 8, fontSize: 16 },
});
