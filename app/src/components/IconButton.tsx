import { Pressable, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { IconName } from '@/toc';

type Props = { icon: IconName; label: string; onPress: () => void; color: string; size?: number; disabled?: boolean };

export function IconButton({ icon, label, onPress, color, size = 24, disabled }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.btn, (pressed || disabled) && styles.dim]}
    >
      <MaterialCommunityIcons name={icon} size={size} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({ btn: { padding: 8 }, dim: { opacity: 0.5 } });
