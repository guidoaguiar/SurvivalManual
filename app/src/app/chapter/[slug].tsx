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
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ slug: string; block?: string; anchor?: string; q?: string }>();
  const chapter = useMemo(() => loadChapter(params.slug), [params.slug]);
  if (!chapter) return <NotFound />;
  const initialBlock = resolveInitialBlock(chapter, params, useReading.getState().last);
  return (
    <Reader
      key={`${chapter.slug}|${params.q ?? ''}`}
      chapter={chapter}
      title={chapterTitle(chapter.slug, t)}
      initialBlock={initialBlock}
      initialQuery={params.q}
    />
  );
}
