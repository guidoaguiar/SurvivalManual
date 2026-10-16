import { Redirect } from 'expo-router';
import { useReading } from '@/store/reading';
import { toc, tocBySlug } from '@/toc';

export default function Index() {
  const last = useReading((s) => s.last);
  const slug = last && tocBySlug.has(last.slug) ? last.slug : toc[0].slug;
  return <Redirect href={`/chapter/${slug}`} />;
}
