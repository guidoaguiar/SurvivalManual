import { router, type Href } from 'expo-router';
import { useReading } from '@/store/reading';
import { toc, tocBySlug } from '@/toc';

// Code never navigates to '/': on a drawer that is a JUMP_TO that moves the launch route (index) to the end
// of history, after which Android Back can never reach [index] and leave the app.
export function lastChapterHref(): Href {
  const last = useReading.getState().last;
  return `/chapter/${last && tocBySlug.has(last.slug) ? last.slug : toc[0].slug}`;
}

export function goBack(fallback: Href = lastChapterHref()) {
  if (router.canGoBack()) router.back();
  else router.replace(fallback);
}
