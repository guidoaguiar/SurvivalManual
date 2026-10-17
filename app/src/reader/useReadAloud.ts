import { useCallback, useEffect, useRef, useState } from 'react';
import * as Speech from 'expo-speech';
import { blockText } from '@/lib/blockText';
import type { Block } from '@/types/content';

// Speech.pause is iOS-only, so "pause" is stop + resume from the first visible block.
export function useReadAloud(blocks: Block[], rate: number, language = 'en') {
  const [speaking, setSpeaking] = useState<number | null>(null);
  const run = useRef(0);

  const speakFrom = useCallback(
    (start: number) => {
      const token = ++run.current;
      const next = (k: number) => {
        if (token !== run.current) return;
        while (k < blocks.length && !blockText(blocks[k]).trim()) k++;
        if (k >= blocks.length) {
          setSpeaking(null);
          return;
        }
        setSpeaking(k);
        Speech.speak(blockText(blocks[k]), {
          rate,
          language,
          onDone: () => next(k + 1),
          onError: () => {
            if (token === run.current) setSpeaking(null);
          },
        });
      };
      Speech.stop();
      next(start);
    },
    [blocks, rate, language],
  );

  const stop = useCallback(() => {
    run.current++;
    Speech.stop();
    setSpeaking(null);
  }, []);

  useEffect(() => stop, [stop]);

  return { speaking, speakFrom, stop };
}
