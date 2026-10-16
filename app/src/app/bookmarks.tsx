import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Empty } from '@/components/Empty';
import { IconButton } from '@/components/IconButton';
import { chapterTitle } from '@/lib/chapters';
import { useTitle } from '@/lib/useTitle';
import { useBookmarks } from '@/store/bookmarks';
import { useColors } from '@/theme';

export default function BookmarksScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  useTitle(t('bookmarks'));
  const items = useBookmarks((s) => s.items);
  const remove = useBookmarks((s) => s.remove);
  if (!items.length) return <Empty text={t('bookmarks_empty')} />;
  return (
    <FlatList
      data={[...items].sort((a, b) => b.createdAt - a.createdAt)}
      keyExtractor={(b) => b.id}
      renderItem={({ item }) => (
        <View style={[styles.row, { borderColor: colors.border }]}>
          <Pressable
            accessibilityRole="button"
            style={styles.main}
            onPress={() => router.push({ pathname: '/chapter/[slug]', params: { slug: item.slug, block: String(item.blockIndex) } })}
          >
            <Text style={[styles.title, { color: colors.text }]}>{chapterTitle(item.slug, t)}</Text>
            {item.label ? <Text style={{ color: colors.muted }}>{item.label}</Text> : null}
          </Pressable>
          <IconButton icon="delete-outline" label={t('delete')} color={colors.muted} onPress={() => remove(item.id)} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 16, paddingRight: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  main: { flex: 1, paddingVertical: 12 },
  title: { fontSize: 16, fontWeight: '600' },
});
