import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import * as Location from 'expo-location';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { useColors } from '@/theme';
import { cardinal } from './cardinal';
import { CompassUnavailable } from './CompassUnavailable';

type Reading = { degrees: number; isTrue: boolean; accuracy: number };

export function Compass() {
  const { t } = useTranslation();
  const colors = useColors();
  const [reading, setReading] = useState<Reading | null>(null);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let sub: { remove(): void } | undefined;
    let cancelled = false;
    (async () => {
      try {
        const { granted } = await Location.requestForegroundPermissionsAsync();
        if (!granted && !cancelled) setPermissionDenied(true);
        const s = await Location.watchHeadingAsync((h) => {
          const isTrue = h.trueHeading >= 0;
          setReading({ degrees: isTrue ? h.trueHeading : h.magHeading, isTrue, accuracy: h.accuracy });
        });
        if (cancelled) s.remove();
        else sub = s;
      } catch {
        if (!cancelled) setUnavailable(true);
      }
    })();
    return () => {
      cancelled = true;
      sub?.remove();
    };
  }, []);

  if (unavailable) return <CompassUnavailable />;

  const deg = reading?.degrees ?? 0;
  const northLabel = reading?.isTrue ? t('compass_true') : t('compass_magnetic');
  const headingLabel = reading ? `${t('compass_heading_a11y', { deg: Math.round(deg), dir: t('dir_' + cardinal(deg) + '_full') })}, ${northLabel}` : undefined;
  return (
    <View style={styles.box}>
      <View style={styles.face} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <View style={[styles.dial, { borderColor: colors.border, transform: [{ rotate: `${-deg}deg` }] }]}>
          {(['n', 'e', 's', 'w'] as const).map((d, i) => (
            <Text key={d} style={[styles.mark, MARKS[i], { color: i === 0 ? colors.danger : colors.text }]}>
              {t('dir_' + d)}
            </Text>
          ))}
        </View>
        <View style={[styles.needle, { backgroundColor: colors.danger }]} />
      </View>
      <Text style={[styles.heading, { color: colors.text }]} accessibilityLabel={headingLabel} accessibilityLiveRegion="polite">
        {reading ? `${Math.round(deg)}° ${t('dir_' + cardinal(deg))}` : '…'}
      </Text>
      {reading && <Text style={{ color: colors.muted }}>{northLabel}</Text>}
      {permissionDenied && <Text style={[styles.note, { color: colors.muted }]}>{t('compass_permission')}</Text>}
      {reading && reading.accuracy <= 1 && <Text style={[styles.note, { color: colors.danger }]}>{t('compass_calibrate')}</Text>}
      <Button variant="plain" label={t('compass_learn')} onPress={() => router.push('/chapter/DirectionFinding')} />
    </View>
  );
}

const SIZE = 260;
const MARKS = [
  { top: 8, alignSelf: 'center' as const },
  { right: 12, top: SIZE / 2 - 14 },
  { bottom: 8, alignSelf: 'center' as const },
  { left: 12, top: SIZE / 2 - 14 },
];

const styles = StyleSheet.create({
  box: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  face: { width: SIZE, height: SIZE },
  dial: { width: SIZE, height: SIZE, borderRadius: SIZE / 2, borderWidth: 3 },
  mark: { position: 'absolute', fontSize: 22, fontWeight: 'bold' },
  // needle sits inside `face`, pointing up from the centre to just inside the N mark
  needle: { position: 'absolute', width: 4, height: SIZE / 2 - 30, top: 30, left: SIZE / 2 - 2, borderRadius: 2 },
  heading: { fontSize: 36, fontWeight: 'bold', marginTop: 24 },
  note: { textAlign: 'center', marginTop: 8 },
});
