import { useMemo } from 'react';
import { useLocalSearchParams, type ErrorBoundaryProps } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { NotFound } from '@/components/NotFound';
import { chapterTitle, loadChapter, resolveInitialBlock } from '@/lib/chapters';
import { Reader } from '@/reader/Reader';
import { useReading } from '@/store/reading';
import { toc } from '@/toc';

export async function generateStaticParams() {
  return toc.map((e) => ({ slug: e.slug }));
}

export function ErrorBoundary(_: ErrorBoundaryProps) {
  return <NotFound />;
}

export default function ChapterScreen() {
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ slug: string; block?: string; anchor?: string; q?: string }>();
  const chapter = useMemo(() => loadChapter(params.slug, i18n.language), [params.slug, i18n.language]);
  const initialBlock = useMemo(
    () => (chapter ? resolveInitialBlock(chapter, params, useReading.getState().last) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chapter, params.block, params.anchor],
  );
  if (!chapter) return <NotFound />;
  return (
    <Reader
      key={`${i18n.language}|${chapter.slug}|${params.q ?? ''}`}
      chapter={chapter}
      title={chapterTitle(chapter.slug, t)}
      initialBlock={initialBlock}
      initialQuery={params.q}
    />
  );
}
