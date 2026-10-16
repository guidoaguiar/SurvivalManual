import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router, usePathname, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { hasCard, useEmergency } from '@/store/emergency';
import { useColors } from '@/theme';
import { toc, type IconName, type TocEntry } from '@/toc';

type Props = { navigation: { closeDrawer(): void } };

export function DrawerContent({ navigation }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const card = useEmergency((s) => s.card);
  const [appendixOpen, setAppendixOpen] = useState(false);

  const go = (href: Href) => {
    navigation.closeDrawer();
    router.navigate(href);
  };
  const row = (icon: IconName, label: string, path: string, emphasis = false) => (
    <Row key={emphasis ? `pinned:${path}` : path} icon={icon} label={label} active={pathname === path} emphasis={emphasis} onPress={() => go(path as Href)} />
  );
  const chapterRow = (e: TocEntry) => row(e.icon ?? 'book-open-page-variant-outline', t(e.titleKey), `/chapter/${e.slug}`);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={[styles.content, { paddingTop: insets.top + 12 }]}>
      <Text style={[styles.title, { color: colors.text }]}>{t('app_name')}</Text>
      {hasCard(card) && row('card-account-details-star', t('emergency_card'), '/tools/emergency-card', true)}
      {row('magnify', t('search'), '/search')}
      <Section label={t('chapters')} />
      {toc.filter((e) => e.listed !== false && !e.appendix).map(chapterRow)}
      <Row icon={appendixOpen ? 'chevron-down' : 'chevron-right'} label={t('appendix')} onPress={() => setAppendixOpen((o) => !o)} />
      {appendixOpen && toc.filter((e) => e.listed !== false && e.appendix).map(chapterRow)}
      <Section label={t('tools_section')} />
      {row('bookmark-multiple-outline', t('bookmarks'), '/bookmarks')}
      {row('history', t('recents'), '/recents')}
      {row('format-list-checks', t('checklists'), '/tools/checklists')}
      {row('alarm-light-outline', t('sos'), '/tools/sos')}
      {row('compass-outline', t('compass'), '/tools/compass')}
      {row('card-account-details-outline', t('emergency_card'), '/tools/emergency-card')}
      {row('cog-outline', t('settings'), '/settings')}
    </ScrollView>
  );
}

function Section({ label }: { label: string }) {
  const colors = useColors();
  return <Text style={[styles.section, { color: colors.muted }]}>{label.toUpperCase()}</Text>;
}

function Row({ icon, label, active, emphasis, onPress }: { icon: IconName; label: string; active?: boolean; emphasis?: boolean; onPress: () => void }) {
  const colors = useColors();
  const fg = emphasis ? colors.danger : active ? colors.accent : colors.text;
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: !!active }} onPress={onPress} style={[styles.row, active && { backgroundColor: colors.surface }]}>
      <MaterialCommunityIcons name={icon} size={22} color={fg} />
      <Text style={[styles.label, { color: fg }, emphasis && styles.bold]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 24 },
  title: { fontSize: 20, fontWeight: 'bold', paddingHorizontal: 16, marginBottom: 8 },
  section: { fontSize: 12, fontWeight: '600', paddingHorizontal: 16, marginTop: 16, marginBottom: 4 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, gap: 16 },
  label: { fontSize: 15 },
  bold: { fontWeight: 'bold' },
});
