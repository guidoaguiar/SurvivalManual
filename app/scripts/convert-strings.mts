// One-off: converts the legacy Android strings.xml files to i18next JSON.
// Output is committed. New UI strings go in src/i18n/locales/<lang>.json, never here.
import { readFileSync, writeFileSync } from 'node:fs';
import { XMLParser } from 'fast-xml-parser';

const RES = new URL('../../android/src/main/res/', import.meta.url);
const OUT = new URL('../src/i18n/locales/', import.meta.url);
const LOCALES: Record<string, string> = { en: 'values', fr: 'values-fr' };
const SKIP = new Set(['help_text']);

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', textNodeName: 'text', parseTagValue: false, isArray: (n) => n === 'string' });
const unescape = (s: string) => s.trim().replace(/\\n/g, '\n').replace(/\\(['"@?\\])/g, '$1');

for (const [lang, dir] of Object.entries(LOCALES)) {
  const xml = readFileSync(new URL(`${dir}/strings.xml`, RES), 'utf8');
  const entries: { name: string; text?: string; translatable?: string }[] = parser.parse(xml).resources.string ?? [];
  const out: Record<string, string> = {};
  for (const e of entries) {
    if (e.translatable === 'false' || SKIP.has(e.name) || e.text == null) continue;
    out[e.name] = unescape(String(e.text));
  }
  writeFileSync(new URL(`legacy.${lang}.json`, OUT), `${JSON.stringify(out, null, 2)}\n`);
  console.log(`legacy.${lang}.json: ${Object.keys(out).length} strings`);
}
