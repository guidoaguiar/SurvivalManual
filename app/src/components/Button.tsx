import { Pressable, StyleSheet, Text } from 'react-native';
import { useColors } from '@/theme';

type Props = { label: string; onPress: () => void; variant?: 'primary' | 'danger' | 'plain'; disabled?: boolean };

export function Button({ label, onPress, variant = 'primary', disabled }: Props) {
  const colors = useColors();
  const bg = variant === 'primary' ? colors.primary : variant === 'danger' ? colors.danger : 'transparent';
  const fg = variant === 'plain' ? colors.accent : colors.onPrimary;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.btn, { backgroundColor: bg }, (pressed || disabled) && styles.dim]}
    >
      <Text style={[styles.label, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center', marginVertical: 6 },
  label: { fontSize: 16, fontWeight: '600' },
  dim: { opacity: 0.5 },
});
