import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/theme';

export function Empty({ text }: { text: string }) {
  const colors = useColors();
  return (
    <View style={styles.box}>
      <Text style={[styles.text, { color: colors.muted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({ box: { flex: 1, padding: 24, justifyContent: 'center' }, text: { fontSize: 16, textAlign: 'center' } });
