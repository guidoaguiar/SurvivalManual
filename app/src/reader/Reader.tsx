import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Linking, StyleSheet, View, type ViewToken } from 'react-native';
import { router, useFocusEffect, type Href } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useTranslation } from 'react-i18next';
import { IconButton } from '@/components/IconButton';
import { translated } from '@/content/manifest';
import { nearestHeading } from '@/lib/chapters';
import { useTitle } from '@/lib/useTitle';
import { BlockView } from '@/render/BlockView';
import { RenderProvider, type RenderCtx } from '@/render/RenderContext';
import { queryTerms } from '@/search/highlight';
import { bookmarkId, useBookmarks } from '@/store/bookmarks';
import { useReading } from '@/store/reading';
import { fontSize, useSettings } from '@/store/settings';
import { useColors } from '@/theme';
import type { Block, Chapter } from '@/types/content';
import { FindBar } from './FindBar';
import { useMatches } from './useMatches';
import { useReadAloud } from './useReadAloud';

type Props = { chapter: Chapter; title: string; initialBlock: number; initialQuery?: string };

const VIEWABILITY = { itemVisiblePercentThreshold: 10 };

function openLink(href: string) {
  if (href.startsWith('/')) router.push(href as Href);
  else void Linking.openURL(href);
}

function openImage(src: string) {
  router.push({ pathname: '/image/[name]', params: { name: src } });
}

export function Reader({ chapter, title, initialBlock, initialQuery }: Props) {
  const { t, i18n } = useTranslation();
  const colors = useColors();
  const fontStep = useSettings((s) => s.fontStep);
  const keepAwake = useSettings((s) => s.keepAwake);
  const ttsRate = useSettings((s) => s.ttsRate);
  const listRef = useRef<FlatList<Block>>(null);
  const retried = useRef(-1);
  const restored = useRef(initialBlock === 0);
  const [firstVisible, setFirstVisible] = useState(initialBlock);
  const [query, setQuery] = useState(initialQuery ?? '');
  const [findOpen, setFindOpen] = useState(!!initialQuery);
  const firstMatch = (m: number[]) => Math.max(0, m.findIndex((x) => x >= initialBlock));
  const terms = useMemo(() => (findOpen ? queryTerms(query) : []), [findOpen, query]);
  const matches = useMatches(chapter.blocks, terms);
  const [cursor, setCursor] = useState(() => firstMatch(matches));
  const [seenMatches, setSeenMatches] = useState(matches);
  if (seenMatches !== matches) {
    setSeenMatches(matches);
    setCursor(firstMatch(matches));
  }
  // Untranslated chapters fall back to English text, so speak them with an English voice.
  const speechLang = translated[i18n.language]?.includes(chapter.slug) ? i18n.language : 'en';
  const { speaking, speakFrom, stop } = useReadAloud(chapter.blocks, ttsRate, speechLang);
  const bookmarked = useBookmarks((s) => s.items.some((b) => b.id === bookmarkId(chapter.slug, firstVisible)));
  const toggleBookmark = useBookmarks((s) => s.toggle);

  const scrollTo = useCallback((index: number, animated = true) => {
    listRef.current?.scrollToIndex({ index, animated, viewPosition: 0 });
  }, []);

  useEffect(() => {
    useReading.getState().visit(chapter.slug);
  }, [chapter.slug]);

  useEffect(() => {
    if (initialBlock > 0)
      requestAnimationFrame(() => {
        scrollTo(initialBlock, false);
        restored.current = true;
      });
  }, [initialBlock, scrollTo]);


  useEffect(() => {
    if (speaking != null) scrollTo(speaking);
  }, [speaking, scrollTo]);

  useFocusEffect(
    useCallback(() => {
      if (!keepAwake) return;
      activateKeepAwakeAsync('reader').catch(() => {});
      return () => {
        Promise.resolve(deactivateKeepAwake('reader')).catch(() => {});
      };
    }, [keepAwake]),
  );

  useFocusEffect(useCallback(() => () => stop(), [stop]));

  // FlatList requires a stable callback; the Reader is keyed by chapter, so the slug is fixed.
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const indexes = viewableItems.map((v) => v.index).filter((i): i is number => i != null);
      if (!indexes.length || !restored.current) return;
      const first = Math.min(...indexes);
      setFirstVisible(first);
      useReading.getState().setLast(chapter.slug, first);
    },
    [chapter.slug],
  );

  const onScrollToIndexFailed = useCallback((info: { index: number; averageItemLength: number }) => {
    listRef.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: false });
    if (retried.current === info.index) return;
    retried.current = info.index;
    setTimeout(() => listRef.current?.scrollToIndex({ index: info.index, animated: false }), 100);
  }, []);

  const goMatch = (delta: number) => {
    if (!matches.length) return;
    const next = (cursor + delta + matches.length) % matches.length;
    setCursor(next);
    scrollTo(matches[next]);
  };

  const headerRight = useCallback(
    () => (
      <View style={styles.actions}>
        <IconButton icon="magnify" label={t('find_in_chapter')} color={colors.onPrimary} onPress={() => setFindOpen((o) => !o)} />
        <IconButton
          icon={speaking != null ? 'stop' : 'volume-high'}
          label={speaking != null ? t('stop_reading') : t('read_aloud')}
          color={colors.onPrimary}
          onPress={() => (speaking != null ? stop() : speakFrom(firstVisible))}
        />
        <IconButton
          icon={bookmarked ? 'bookmark' : 'bookmark-outline'}
          label={bookmarked ? t('bookmark_remove') : t('bookmark_add')}
          color={colors.onPrimary}
          onPress={() => toggleBookmark(chapter.slug, firstVisible, nearestHeading(chapter, firstVisible))}
        />
      </View>
    ),
    [t, colors.onPrimary, speaking, stop, speakFrom, firstVisible, bookmarked, toggleBookmark, chapter],
  );
  useTitle(title, headerRight);

  const ctx = useMemo<RenderCtx>(() => ({ fontSize: fontSize(fontStep), colors, terms, onLink: openLink, onImage: openImage }), [fontStep, colors, terms]);

  return (
    <RenderProvider value={ctx}>
      {findOpen && (
        <FindBar
          query={query}
          onChangeQuery={setQuery}
          total={matches.length}
          current={cursor}
          onPrev={() => goMatch(-1)}
          onNext={() => goMatch(1)}
          onClose={() => setFindOpen(false)}
        />
      )}
      <FlatList
        ref={listRef}
        data={chapter.blocks}
        extraData={speaking}
        keyExtractor={(_, i) => String(i)}
        renderItem={({ item, index }) => (
          <View style={[styles.block, index === speaking && { backgroundColor: colors.surface }]}>
            <BlockView block={item} />
          </View>
        )}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY}
        onScrollToIndexFailed={onScrollToIndexFailed}
        initialNumToRender={Math.max(10, initialBlock + 2)}
        windowSize={11}
        contentContainerStyle={styles.content}
      />
    </RenderProvider>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row' },
  content: { padding: 16, paddingBottom: 48, width: '100%', maxWidth: 760, alignSelf: 'center' },
  block: { borderRadius: 4 },
});
