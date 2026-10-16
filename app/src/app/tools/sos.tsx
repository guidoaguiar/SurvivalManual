import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { type AudioPlayer, useAudioPlayer } from 'expo-audio';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { useTitle } from '@/lib/useTitle';
import { useColors } from '@/theme';
import { encode, runTimeline, toTimeline, unitMs } from '@/tools/morse';

const beep = require('../../../assets/beep.wav');
const MIN_WPM = 5;
const MAX_WPM = 20;

// Mutating a hook-returned player is the expo-audio API; kept out of the component body for the compiler lint.
const enableLoop = (p: AudioPlayer) => {
  p.loop = true;
};

export default function SosScreen() {
  const { t } = useTranslation();
  const colors = useColors();
  useTitle(t('sos'));
  const [message, setMessage] = useState('SOS');
  const [wpm, setWpm] = useState(8);
  const [outputs, setOutputs] = useState({ torch: false, screen: true, tone: false });
  const [loop, setLoop] = useState(true);
  const [running, setRunning] = useState(false);
  const [on, setOn] = useState(false);
  const [torchError, setTorchError] = useState(false);
  const [torchDenied, setTorchDenied] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const player = useAudioPlayer(beep);
  const cancel = useRef<(() => void) | null>(null);
  const { code, skipped } = useMemo(() => encode(message), [message]);
  const permBlocked = !!permission && !permission.granted && !permission.canAskAgain;
  const torchSupported = Platform.OS !== 'web' && !torchError && !permBlocked;

  const stop = useCallback(() => {
    cancel.current?.();
    cancel.current = null;
    setRunning(false);
    setOn(false);
  }, []);

  const start = () => {
    if (!code) return;
    setRunning(true);
    cancel.current = runTimeline(toTimeline(code), unitMs(wpm), setOn, loop, () => setRunning(false));
  };

  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (!outputs.tone) return;
    if (running && on) {
      enableLoop(player);
      void player.seekTo(0);
      player.play();
    } else {
      player.pause();
    }
  }, [on, running, outputs.tone, player]);

  const setTorch = async (value: boolean) => {
    if (value && !permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        setTorchDenied(true);
        return;
      }
    }
    setOutputs((o) => ({ ...o, torch: value }));
  };

  const toggle = (label: string, value: boolean, onChange: (v: boolean) => void, disabled = false) => (
    <View style={styles.switchRow}>
      <Text style={[styles.switchLabel, { color: colors.text }]}>{label}</Text>
      <Switch accessibilityLabel={label} value={value} disabled={disabled} onValueChange={onChange} />
    </View>
  );

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Text style={[styles.label, { color: colors.text }]}>{t('sos_message')}</Text>
      <View style={styles.messageRow}>
        <TextInput
          accessibilityLabel={t('sos_message')}
          value={message}
          onChangeText={setMessage}
          autoCapitalize="characters"
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        />
        <Button variant="plain" label="SOS" onPress={() => setMessage('SOS')} />
      </View>
      <Text style={[styles.label, { color: colors.text }]}>{t('sos_code')}</Text>
      <Text selectable style={[styles.code, { color: colors.text }]}>
        {code}
      </Text>
      {skipped.length > 0 && <Text style={{ color: colors.danger }}>{t('sos_skipped', { chars: skipped.join(' ') })}</Text>}

      <View style={styles.speedRow}>
        <IconButton icon="minus" label={t('sos_slower')} color={colors.text} onPress={() => setWpm((w) => Math.max(MIN_WPM, w - 1))} />
        <Text style={{ color: colors.text }}>{t('sos_speed', { wpm })}</Text>
        <IconButton icon="plus" label={t('sos_faster')} color={colors.text} onPress={() => setWpm((w) => Math.min(MAX_WPM, w + 1))} />
      </View>

      {Platform.OS !== 'web' && toggle(t('sos_torch'), outputs.torch, (v) => void setTorch(v), !torchSupported)}
      {Platform.OS !== 'web' && torchError && <Text style={{ color: colors.muted }}>{t('sos_no_torch')}</Text>}
      {Platform.OS !== 'web' && (torchDenied || permBlocked) && <Text style={{ color: colors.muted }}>{t('sos_torch_permission')}</Text>}
      {toggle(t('sos_screen'), outputs.screen, (v) => setOutputs((o) => ({ ...o, screen: v })))}
      {toggle(t('sos_tone'), outputs.tone, (v) => setOutputs((o) => ({ ...o, tone: v })))}
      {toggle(t('sos_loop'), loop, setLoop)}

      {running ? <Button variant="danger" label={t('sos_stop')} onPress={stop} /> : <Button label={t('sos_start')} disabled={!code} onPress={start} />}

      {outputs.torch && torchSupported && permission?.granted && (
        <CameraView style={styles.hiddenCamera} enableTorch={running && on} onMountError={() => setTorchError(true)} />
      )}

      <Modal visible={running && outputs.screen} animationType="none" onRequestClose={stop}>
        <Pressable testID="strobe" accessibilityLabel={t('sos_stop')} onPress={stop} style={[styles.fill, { backgroundColor: on ? '#ffffff' : '#000000' }]} />
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, maxWidth: 760, width: '100%', alignSelf: 'center' },
  label: { fontSize: 15, fontWeight: '600', marginTop: 12, marginBottom: 4 },
  messageRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 10, fontSize: 18 },
  code: { fontSize: 22, letterSpacing: 2, fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) },
  speedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 12 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 6 },
  switchLabel: { fontSize: 16 },
  hiddenCamera: { width: 1, height: 1, opacity: 0 },
  fill: { flex: 1 },
});
