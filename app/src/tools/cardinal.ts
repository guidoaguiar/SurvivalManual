const NAMES = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'] as const;

export type Cardinal = (typeof NAMES)[number];

export function cardinal(deg: number): Cardinal {
  const d = ((deg % 360) + 360) % 360;
  return NAMES[Math.round(d / 45) % 8];
}
