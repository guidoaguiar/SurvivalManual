import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { useTitle } from '@/lib/useTitle';
import { useChecklists } from '@/store/checklists';
import { useColors } from '@/theme';
import { checklistTemplates } from '@/tools/checklistTemplates';

export default function ChecklistsScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  useTitle(t('checklists'));
  const lists = useChecklists((s) => s.lists);
  const create = useChecklists((s) => s.create);
  const [picking, setPicking] = useState(false);

  const open = (id: string) => router.push({ pathname: '/tools/checklist', params: { id } });
  const start = (title: string, items: string[], templateId?: string) => {
    setPicking(false);
    open(create(title, items, templateId));
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      {lists.length === 0 && <Text style={[styles.empty, { color: colors.muted }]}>{t('checklists_empty')}</Text>}
      {lists.map((l) => (
        <Pressable key={l.id} accessibilityRole="button" onPress={() => open(l.id)} style={[styles.card, { borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>{l.title}</Text>
          <Text style={{ color: colors.muted }}>{`${l.items.filter((i) => i.done).length}/${l.items.length}`}</Text>
        </Pressable>
      ))}
      {picking ? (
        <>
          <Text style={[styles.label, { color: colors.text }]}>{t('checklist_from_template')}</Text>
          {checklistTemplates.map((tpl) => (
            <Button key={tpl.id} variant="plain" label={t(tpl.titleKey)} onPress={() => start(t(tpl.titleKey), tpl.items, tpl.id)} />
          ))}
          <Button variant="plain" label={t('checklist_blank')} onPress={() => start(t('checklist_new'), [])} />
        </>
      ) : (
        <Button label={t('checklist_new')} onPress={() => setPicking(true)} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, maxWidth: 760, width: '100%', alignSelf: 'center' },
  empty: { fontSize: 16, marginBottom: 16 },
  card: { flexDirection: 'row', justifyContent: 'space-between', padding: 14, borderWidth: 1, borderRadius: 8, marginBottom: 8 },
  title: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 16, fontWeight: '600', marginTop: 12 },
});
