import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/theme';

type Props<T> = { value: T; options: [T, string][]; onChange: (v: T) => void };

export function Choices<T extends string | number>({ value, options, onChange }: Props<T>) {
  const colors = useColors();
  return (
    <View style={styles.row}>
      {options.map(([v, label]) => {
        const selected = v === value;
        return (
          <Pressable
            key={String(v)}
            accessibilityRole="radio"
            accessibilityLabel={label}
            accessibilityState={{ checked: selected }}
            onPress={() => onChange(v)}
            style={[styles.chip, { borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : 'transparent' }]}
          >
            <Text style={{ color: selected ? colors.onPrimary : colors.text }}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { minHeight: 44, justifyContent: 'center', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1 },
});
