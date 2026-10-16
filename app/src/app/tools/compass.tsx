import { useTranslation } from 'react-i18next';
import { useTitle } from '@/lib/useTitle';
import { Compass } from '@/tools/Compass';

export default function CompassScreen() {
  const { t } = useTranslation();
  useTitle(t('compass'));
  return <Compass />;
}
