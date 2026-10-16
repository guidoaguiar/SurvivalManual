const NAMES = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function cardinal(deg: number): string {
  const d = ((deg % 360) + 360) % 360;
  return NAMES[Math.round(d / 45) % 8];
}
