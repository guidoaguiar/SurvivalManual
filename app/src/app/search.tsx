import { useDeferredValue, useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Empty } from '@/components/Empty';
import { chapterTitle } from '@/lib/chapters';
import { useTitle } from '@/lib/useTitle';
import { queryTerms, splitHighlights } from '@/search/highlight';
import { searchManual } from '@/search/search';
import { useColors } from '@/theme';

export default function SearchScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  useTitle(t('search'));
  const [q, setQ] = useState('');
  const query = useDeferredValue(q);
  const terms = useMemo(() => queryTerms(query), [query]);
  const sections = useMemo(
    () => searchManual(query).map((g, gi) => ({ title: chapterTitle(g.slug, t), gi, data: g.sections })),
    [query, t],
  );

  return (
    <View style={styles.fill}>
      <TextInput
        testID="search-input"
        value={q}
        onChangeText={setQ}
        autoFocus
        placeholder={t('search_placeholder')}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
      />
      {query.trim() !== '' && sections.length === 0 ? (
        <Empty text={t('search_no_results', { q: query })} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(s) => `${s.slug}#${s.block}`}
          keyboardShouldPersistTaps="handled"
          renderSectionHeader={({ section }) => <Text style={[styles.chapter, { color: colors.accent, backgroundColor: colors.background }]}>{section.title}</Text>}
          renderItem={({ item, index, section }) => (
            <Pressable
              testID={`search-result-${section.gi}-${index}`}
              onPress={() => router.push({ pathname: '/chapter/[slug]', params: { slug: item.slug, block: String(item.block), q: query } })}
              style={[styles.item, { borderColor: colors.border }]}
            >
              <Text style={[styles.heading, { color: colors.text }]}>{item.heading}</Text>
              <Text style={{ color: colors.muted }}>
                {splitHighlights(item.excerpt, terms).map((r, i) =>
                  r.match ? (
                    <Text key={i} style={{ backgroundColor: colors.highlight, color: colors.highlightText }}>
                      {r.text}
                    </Text>
                  ) : (
                    r.text
                  ),
                )}
              </Text>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  input: { margin: 12, padding: 12, borderRadius: 8, borderWidth: StyleSheet.hairlineWidth, fontSize: 16 },
  chapter: { fontWeight: 'bold', fontSize: 14, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  item: { paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  heading: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
});
