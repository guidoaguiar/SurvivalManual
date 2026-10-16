import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Choices } from '@/components/Choices';
import { useTitle } from '@/lib/useTitle';
import { fontSize, useSettings, type ThemeMode } from '@/store/settings';
import { useColors } from '@/theme';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  useTitle(t('settings'));
  const s = useSettings();
  const label = (text: string) => <Text style={[styles.label, { color: colors.text }]}>{text}</Text>;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {label(t('preference_daynight_title'))}
      <Choices<ThemeMode>
        value={s.theme}
        options={[['system', t('system')], ['day', t('day')], ['night', t('night')], ['amoled', t('amoled')]]}
        onChange={(theme) => s.set({ theme })}
      />
      {label(t('preference_fontsize_title'))}
      <Choices<number>
        value={s.fontStep}
        options={[[0, t('tiny')], [1, t('small')], [2, t('medium')], [3, t('large')], [4, t('huge')]]}
        onChange={(fontStep) => s.set({ fontStep })}
      />
      <Text style={{ color: colors.text, fontSize: fontSize(s.fontStep), marginBottom: 16 }}>{t('font_preview')}</Text>
      <View style={styles.switchRow}>
        <Text style={[styles.switchLabel, { color: colors.text }]}>{t('keep_awake')}</Text>
        <Switch accessibilityRole="switch" value={s.keepAwake} onValueChange={(keepAwake) => s.set({ keepAwake })} />
      </View>
      {label(t('tts_rate'))}
      <Choices<number>
        value={s.ttsRate}
        options={[[0.75, '0.75×'], [1, '1×'], [1.25, '1.25×'], [1.5, '1.5×']]}
        onChange={(ttsRate) => s.set({ ttsRate })}
      />
      {label(t('language'))}
      <Choices<string>
        value={s.language ?? 'system'}
        options={[['system', t('language_system')], ['en', 'English'], ['fr', 'Français']]}
        onChange={(v) => s.set({ language: v === 'system' ? undefined : v })}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, maxWidth: 760, width: '100%', alignSelf: 'center' },
  label: { fontSize: 16, fontWeight: '600', marginTop: 12, marginBottom: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 8 },
  switchLabel: { flex: 1, fontSize: 16 },
});
