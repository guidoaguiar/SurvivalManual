import { useCallback } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { images } from '@/content/images';
import { IconButton } from '@/components/IconButton';
import { NotFound } from '@/components/NotFound';
import { ZoomableImage } from '@/components/ZoomableImage';
import { goBack } from '@/lib/nav';
import { useTitle } from '@/lib/useTitle';
import { useColors } from '@/theme';

export async function generateStaticParams() {
  return Object.keys(images).map((name) => ({ name }));
}

export default function ImageScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  const { name } = useLocalSearchParams<{ name: string }>();
  const asset = name && Object.prototype.hasOwnProperty.call(images, name) ? images[name] : undefined;
  const close = useCallback(() => <IconButton icon="close" label={t('close')} color={colors.onPrimary} onPress={() => goBack('/')} />, [t, colors.onPrimary]);
  useTitle(name ?? '', close);
  if (!asset) return <NotFound message={t('image_not_found')} />;
  return <ZoomableImage asset={asset} alt={name} />;
}
