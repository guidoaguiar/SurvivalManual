import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { NotFound } from '@/components/NotFound';
import { goBack } from '@/lib/nav';
import { useTitle } from '@/lib/useTitle';
import { useChecklists } from '@/store/checklists';
import { useColors } from '@/theme';

export default function ChecklistScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useTranslation();
  const colors = useColors();
  const list = useChecklists((s) => s.lists.find((l) => l.id === id));
  const { rename, addItem, editItem, removeItem, toggle, reset, remove } = useChecklists.getState();
  const [draft, setDraft] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  useTitle(list?.title ?? t('checklists'));
  if (!list) return <NotFound message={t('checklist_not_found')} />;

  const submit = () => {
    if (!draft.trim()) return;
    addItem(list.id, draft.trim());
    setDraft('');
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <TextInput
        accessibilityLabel={t('checklist_title')}
        value={list.title}
        onChangeText={(v) => rename(list.id, v)}
        style={[styles.title, { color: colors.text, borderColor: colors.border }]}
      />
      {list.items.map((item) => (
        <View key={item.id} style={styles.item}>
          <Pressable accessibilityRole="checkbox" accessibilityLabel={item.text} accessibilityState={{ checked: item.done }} onPress={() => toggle(list.id, item.id)} hitSlop={8}>
            <MaterialCommunityIcons name={item.done ? 'checkbox-marked' : 'checkbox-blank-outline'} size={26} color={colors.primary} />
          </Pressable>
          <TextInput
            value={item.text}
            onChangeText={(v) => editItem(list.id, item.id, v)}
            style={[styles.itemText, { color: item.done ? colors.muted : colors.text }, item.done && styles.done]}
          />
          <IconButton icon="close" label={t('delete')} color={colors.muted} onPress={() => removeItem(list.id, item.id)} />
        </View>
      ))}
      <TextInput
        testID="new-item"
        value={draft}
        onChangeText={setDraft}
        onSubmitEditing={submit}
        placeholder={t('checklist_add_item')}
        placeholderTextColor={colors.muted}
        returnKeyType="done"
        style={[styles.newItem, { color: colors.text, borderColor: colors.border }]}
      />
      <Button variant="plain" label={t('checklist_reset')} onPress={() => reset(list.id)} />
      <Button
        variant="danger"
        label={confirmDelete ? t('checklist_delete_confirm') : t('checklist_delete')}
        onPress={() => {
          if (!confirmDelete) return setConfirmDelete(true);
          remove(list.id);
          goBack('/tools/checklists');
        }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, maxWidth: 760, width: '100%', alignSelf: 'center' },
  title: { fontSize: 20, fontWeight: 'bold', borderBottomWidth: 1, paddingVertical: 8, marginBottom: 12 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemText: { flex: 1, fontSize: 16, paddingVertical: 8 },
  done: { textDecorationLine: 'line-through' },
  newItem: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16, marginVertical: 12 },
});
