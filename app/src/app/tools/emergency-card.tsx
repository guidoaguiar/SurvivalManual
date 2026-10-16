import { useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { useTitle } from '@/lib/useTitle';
import { hasCard, useEmergency, type EmergencyCard } from '@/store/emergency';
import { useColors } from '@/theme';

type TextField = Exclude<keyof EmergencyCard, 'contacts'>;
const FIELDS: [TextField, string, boolean][] = [
  ['name', 'ec_name', false],
  ['bloodType', 'ec_blood', false],
  ['allergies', 'ec_allergies', true],
  ['medications', 'ec_medications', true],
  ['conditions', 'ec_conditions', true],
  ['notes', 'ec_notes', true],
];

export default function EmergencyCardScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  useTitle(t('emergency_card'));
  const card = useEmergency((s) => s.card);
  const update = useEmergency((s) => s.update);
  const [rescuer, setRescuer] = useState(false);
  if (rescuer) return <RescuerView card={card} onClose={() => setRescuer(false)} />;

  const input = { color: colors.text, borderColor: colors.border };
  const setContact = (i: number, patch: Partial<EmergencyCard['contacts'][number]>) =>
    update({ contacts: card.contacts.map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.note, { color: colors.muted }]}>{t('ec_local_only')}</Text>
      {FIELDS.map(([key, labelKey, multiline]) => (
        <View key={key} style={styles.field}>
          <Text style={[styles.label, { color: colors.text }]}>{t(labelKey)}</Text>
          <TextInput accessibilityLabel={t(labelKey)} value={card[key]} multiline={multiline} onChangeText={(v) => update({ [key]: v })} style={[styles.input, input]} />
        </View>
      ))}
      <Text style={[styles.label, { color: colors.text }]}>{t('ec_contacts')}</Text>
      {card.contacts.map((c, i) => (
        <View key={i} style={styles.contact}>
          <TextInput accessibilityLabel={t('ec_contact_name')} placeholder={t('ec_contact_name')} placeholderTextColor={colors.muted} value={c.name} onChangeText={(name) => setContact(i, { name })} style={[styles.input, styles.flex, input]} />
          <TextInput accessibilityLabel={t('ec_contact_phone')} placeholder={t('ec_contact_phone')} placeholderTextColor={colors.muted} keyboardType="phone-pad" value={c.phone} onChangeText={(phone) => setContact(i, { phone })} style={[styles.input, styles.flex, input]} />
          <IconButton icon="close" label={t('delete')} color={colors.muted} onPress={() => update({ contacts: card.contacts.filter((_, j) => j !== i) })} />
        </View>
      ))}
      <Button variant="plain" label={t('ec_add_contact')} onPress={() => update({ contacts: [...card.contacts, { name: '', phone: '' }] })} />
      <Button label={t('ec_show_rescuer')} disabled={!hasCard(card)} onPress={() => setRescuer(true)} />
    </ScrollView>
  );
}

function RescuerView({ card, onClose }: { card: EmergencyCard; onClose: () => void }) {
  useKeepAwake('rescuer');
  const { t } = useTranslation();
  const rows = FIELDS.filter(([key]) => card[key].trim());
  const contacts = card.contacts.filter((c) => c.name.trim() || c.phone.trim());
  return (
    <ScrollView style={styles.rescuer} contentContainerStyle={styles.content}>
      <Text style={styles.rescuerTitle}>{t('ec_rescuer_title')}</Text>
      {rows.map(([key, labelKey]) => (
        <View key={key} style={styles.field}>
          <Text style={styles.rescuerLabel}>{t(labelKey)}</Text>
          <Text style={styles.rescuerValue}>{card[key]}</Text>
        </View>
      ))}
      {contacts.length > 0 && (
        <Text accessibilityRole="header" style={styles.rescuerLabel}>
          {t('ec_contacts')}
        </Text>
      )}
      {contacts
        .map((c, i) => (
          <Text key={i} style={styles.rescuerValue} accessibilityRole={c.phone.trim() ? 'link' : undefined} onPress={c.phone ? () => Linking.openURL(`tel:${c.phone.replace(/\s/g, '')}`) : undefined}>
            {`${c.name} ${c.phone}`.trim()}
          </Text>
        ))}
      <Button label={t('close')} onPress={onClose} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, maxWidth: 760, width: '100%', alignSelf: 'center' },
  note: { fontSize: 14, marginBottom: 12 },
  field: { marginBottom: 12 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 16 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  flex: { flex: 1 },
  rescuer: { backgroundColor: '#000000' },
  rescuerTitle: { color: '#ff5252', fontSize: 28, fontWeight: 'bold', marginBottom: 16 },
  rescuerLabel: { color: '#bbbbbb', fontSize: 18 },
  rescuerValue: { color: '#ffffff', fontSize: 28, fontWeight: 'bold', marginBottom: 8 },
});
