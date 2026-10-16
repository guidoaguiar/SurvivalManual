import { FlatList, Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Empty } from '@/components/Empty';
import { chapterTitle } from '@/lib/chapters';
import { useTitle } from '@/lib/useTitle';
import { useReading } from '@/store/reading';
import { useColors } from '@/theme';

export default function RecentsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  useTitle(t('recents'));
  const recents = useReading((s) => s.recents);
  if (!recents.length) return <Empty text={t('recents_empty')} />;
  return (
    <FlatList
      data={recents}
      keyExtractor={(s) => s}
      renderItem={({ item }) => {
        const title = chapterTitle(item, t);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={title}
            onPress={() => router.push({ pathname: '/chapter/[slug]', params: { slug: item } })}
            style={[styles.row, { borderColor: colors.border }]}
          >
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 16 },
});
