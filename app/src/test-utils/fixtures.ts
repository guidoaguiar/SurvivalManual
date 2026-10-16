import type { Chapter } from '@/types/content';

const p = (value: string) => ({ type: 'paragraph' as const, children: [{ type: 'text' as const, value }] });

export const alpha: Chapter = {
  slug: 'Alpha',
  anchors: { 'alpha-intro': 0, purify: 2, fig1: 4 },
  blocks: [
    { type: 'heading', depth: 1, anchor: 'alpha-intro', children: [{ type: 'text', value: 'Alpha intro' }] },
    p('Clean water is vital. Boil water first.'),
    { type: 'heading', depth: 2, anchor: 'purify', children: [{ type: 'text', value: 'Purify' }] },
    { type: 'paragraph', children: [{ type: 'link', href: '/chapter/Beta', children: [{ type: 'text', value: 'See Beta' }] }] },
    { type: 'image', src: 'a.png', alt: 'Figure 1' },
    p('More water tips.'),
    { type: 'paragraph', children: [{ type: 'link', href: 'https://example.org', children: [{ type: 'text', value: 'Survival wiki' }] }] },
  ],
};

export const beta: Chapter = { slug: 'Beta', anchors: {}, blocks: [{ type: 'heading', depth: 1, children: [{ type: 'text', value: 'Beta' }] }, p('Fire basics.')] };

export const alphaPt: Chapter = {
  slug: 'Alpha',
  anchors: { 'introducao-alfa': 0, fig1: 2 },
  blocks: [
    { type: 'heading', depth: 1, anchor: 'introducao-alfa', children: [{ type: 'text', value: 'Introdução alfa' }] },
    p('Água limpa é vital. Ferva a água primeiro.'),
    { type: 'image', src: 'a.png', alt: 'Figura 1' },
  ],
};

export const chaptersModule = {
  chapterLoaders: {
    en: { Alpha: () => alpha, Beta: () => beta },
    'pt-BR': { Alpha: () => alphaPt, Beta: () => beta },
  },
};

export const imagesModule = { images: { 'a.png': { source: 1, width: 200, height: 100 } } };
