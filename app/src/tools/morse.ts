const MORSE: Record<string, string> = {
  A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--',
  N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
  '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
  '.': '.-.-.-', ',': '--..--', '?': '..--..', "'": '.----.', '!': '-.-.--', '/': '-..-.', '(': '-.--.', ')': '-.--.-', '&': '.-...',
  ':': '---...', ';': '-.-.-.', '=': '-...-', '+': '.-.-.', '-': '-....-', '_': '..--.-', '"': '.-..-.', '@': '.--.-.',
};

export type Step = { on: boolean; units: number };

export function encode(text: string): { code: string; skipped: string[] } {
  const skipped = new Set<string>();
  const words = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      [...word]
        .map((ch) => {
          const c = MORSE[ch];
          if (!c) skipped.add(ch);
          return c;
        })
        .filter(Boolean)
        .join(' '),
    )
    .filter(Boolean);
  return { code: words.join(' / '), skipped: [...skipped] };
}

export function toTimeline(code: string): Step[] {
  const steps: Step[] = [];
  const words = code.split(' / ').map((w) => w.split(' ').filter(Boolean)).filter((w) => w.length);
  words.forEach((letters, wi) => {
    if (wi > 0) steps.push({ on: false, units: 7 });
    letters.forEach((letter, li) => {
      if (li > 0) steps.push({ on: false, units: 3 });
      [...letter].forEach((el, ei) => {
        if (ei > 0) steps.push({ on: false, units: 1 });
        steps.push({ on: true, units: el === '-' ? 3 : 1 });
      });
    });
  });
  if (steps.length) steps.push({ on: false, units: 7 });
  return steps;
}

export const unitMs = (wpm: number) => 1200 / wpm;

export function runTimeline(steps: Step[], unit: number, onChange: (on: boolean) => void, loop: boolean, onDone?: () => void): () => void {
  let i = 0;
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const tick = () => {
    if (cancelled) return;
    if (i >= steps.length) {
      if (loop && steps.length) i = 0;
      else {
        onChange(false);
        onDone?.();
        return;
      }
    }
    const step = steps[i++];
    onChange(step.on);
    timer = setTimeout(tick, step.units * unit);
  };
  tick();
  return () => {
    cancelled = true;
    if (timer) clearTimeout(timer);
    onChange(false);
  };
}
