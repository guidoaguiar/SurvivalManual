// jest.setup already imported '@/i18n' with the real manifest, so load a fresh copy with a content language mocked in.
function loadI18n(): typeof import('@/i18n') {
  let mod!: typeof import('@/i18n');
  jest.isolateModules(() => {
    jest.doMock('@/content/manifest', () => ({ contentLanguages: ['en', 'pt-BR'], translated: { 'pt-BR': ['Alpha'] } }));
    mod = require('@/i18n');
  });
  return mod;
}
const { languageName, languages, pickLanguage } = loadI18n();

it('lists en first, then the rest alphabetically, from locale files and content folders', () => {
  expect(languages[0]).toBe('en');
  expect(languages).toEqual(expect.arrayContaining(['en', 'fr', 'pt-BR']));
  expect([...languages.slice(1)]).toEqual([...languages.slice(1)].sort());
});

it('picks exact tags, then the base language, then English', () => {
  expect(pickLanguage(undefined, { languageTag: 'pt-BR', languageCode: 'pt' })).toBe('pt-BR');
  expect(pickLanguage(undefined, { languageTag: 'pt-PT', languageCode: 'pt' })).toBe('pt-BR');
  expect(pickLanguage(undefined, { languageTag: 'PT-br', languageCode: null })).toBe('pt-BR');
  expect(pickLanguage(undefined, { languageTag: 'fr-CA', languageCode: 'fr' })).toBe('fr');
  expect(pickLanguage(undefined, { languageTag: 'zh-Hans-CN', languageCode: 'zh' })).toBe('en');
  expect(pickLanguage(undefined, { languageTag: 'pt_BR', languageCode: undefined })).toBe('pt-BR');
  expect(pickLanguage(undefined, {})).toBe('en');
  expect(pickLanguage('fr', { languageTag: 'pt-BR' })).toBe('fr');
  expect(pickLanguage('xx', { languageTag: 'pt-BR' })).toBe('en');
});

it('names each language in its own language, falling back to the code', () => {
  expect(languageName('en')).toBe('English');
  expect(languageName('fr')).toBe('Français');
  expect(languageName('zz')).toBe('zz');
});
