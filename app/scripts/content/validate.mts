import type { Converted } from './convert.mjs';

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

export function validate(converted: Map<string, Converted>, fileExists: (name: string) => boolean) {
  const errors: string[] = [];
  const warnings: string[] = [];
  for (const [slug, c] of converted) {
    for (const img of c.images) {
      if (!SCHEME.test(img) && !fileExists(img)) errors.push(`${slug}: missing image "${img}"`);
    }
    for (const l of c.links) {
      const target = converted.get(l.slug);
      if (!target) {
        errors.push(`${slug}: link to unknown chapter "${l.slug}"`);
        continue;
      }
      if (l.anchor && target.chapter.anchors[l.anchor] === undefined) {
        warnings.push(`${slug}: link to unknown anchor "${l.slug}#${l.anchor}" (opens at top)`);
      }
    }
  }
  return { errors, warnings };
}
