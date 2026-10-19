import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import rehypeSlug from 'rehype-slug';
import type { Element, ElementContent, Root, RootContent } from 'hast';
import type { Block, Chapter, Inline } from '../../src/types/content';

export type LinkRef = { slug: string; anchor?: string };
export type Converted = { chapter: Chapter; links: LinkRef[]; images: string[] };

const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype, { allowDangerousHtml: true }).use(rehypeRaw).use(rehypeSlug);

const BLOCK_TAGS = new Set(['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'ol', 'blockquote', 'table', 'pre', 'hr']);
const HEADINGS: Record<string, 1 | 2 | 3 | 4 | 5 | 6> = { h1: 1, h2: 2, h3: 3, h4: 4, h5: 5, h6: 6 };
const SCHEME = /^[a-z][a-z0-9+.-]*:/i;
const IMAGE_FILE = /\.(png|jpe?g|gif|webp)$/i;

type Node = RootContent | ElementContent;
type ImageInline = Extract<Inline, { type: 'image' }>;

const isElement = (n: Node): n is Element => n.type === 'element';
const hasBlockDescendant = (el: Element): boolean =>
  el.children.some((c) => isElement(c) && (BLOCK_TAGS.has(c.tagName) || hasBlockDescendant(c)));
const textOf = (n: Node): string => (n.type === 'text' ? n.value : isElement(n) ? n.children.map(textOf).join('') : '');

class Converter {
  private anchors: string[] = [];
  links: LinkRef[] = [];
  images = new Set<string>();

  constructor(private slug: string) {}

  takeAnchors(): string[] {
    const a = this.anchors;
    this.anchors = [];
    return a;
  }

  blocks(nodes: Node[]): Block[] {
    const out: Block[] = [];
    let run: Inline[] = [];
    const flush = () => {
      out.push(...this.paragraph(run));
      run = [];
    };
    const visit = (node: Node) => {
      if (node.type === 'text') {
        run.push(...this.inline(node));
        return;
      }
      if (!isElement(node)) return;
      if (BLOCK_TAGS.has(node.tagName)) {
        flush();
        this.collectAnchor(node);
        out.push(...this.block(node));
        return;
      }
      if (hasBlockDescendant(node)) {
        // Wrapper such as <center>/<div>/<font> around blocks: unwrap.
        this.collectAnchor(node);
        node.children.forEach(visit);
        return;
      }
      run.push(...this.inline(node));
    };
    nodes.forEach(visit);
    flush();
    return out;
  }

  private block(el: Element): Block[] {
    const tag = el.tagName;
    const depth = HEADINGS[tag];
    if (depth) {
      const id = el.properties.id;
      return [{ type: 'heading', depth, anchor: id != null ? String(id) : undefined, children: trimInlines(el.children.flatMap((c) => this.inline(c))) }];
    }
    switch (tag) {
      case 'p':
        return this.paragraph(el.children.flatMap((c) => this.inline(c)));
      case 'ul':
      case 'ol':
        return [
          {
            type: 'list',
            ordered: tag === 'ol',
            start: Number(el.properties.start ?? 1) || 1,
            items: el.children
              .filter(isElement)
              .filter((c) => c.tagName === 'li')
              .map((li) => {
                this.collectAnchor(li);
                return this.blocks(li.children);
              }),
          },
        ];
      case 'blockquote':
        return [{ type: 'blockquote', children: this.blocks(el.children) }];
      case 'table': {
        const rows = this.rows(el);
        if (!rows.length) return [];
        return [{ type: 'table', header: rows[0].every((c) => c.tagName === 'th'), rows: rows.map((r) => r.map((cell) => this.blocks(cell.children))) }];
      }
      case 'pre':
        return [{ type: 'code', value: textOf(el).replace(/\n$/, '') }];
      case 'hr':
        return [{ type: 'thematicBreak' }];
      default:
        return [];
    }
  }

  private rows(el: Element): Element[][] {
    return el.children.filter(isElement).flatMap((c): Element[][] => {
      if (c.tagName === 'tr') return [c.children.filter(isElement).filter((td) => td.tagName === 'td' || td.tagName === 'th')];
      if (c.tagName === 'thead' || c.tagName === 'tbody' || c.tagName === 'tfoot') return this.rows(c);
      return [];
    });
  }

  private inline(node: Node): Inline[] {
    if (node.type === 'text') return [{ type: 'text', value: node.value.replace(/\s+/g, ' ') }];
    if (!isElement(node)) return [];
    this.collectAnchor(node);
    const kids = () => node.children.flatMap((c) => this.inline(c));
    switch (node.tagName) {
      case 'em':
      case 'i':
        return [{ type: 'emphasis', children: kids() }];
      case 'strong':
      case 'b':
        return [{ type: 'strong', children: kids() }];
      case 'del':
      case 's':
        return [{ type: 'delete', children: kids() }];
      case 'code':
        return [{ type: 'inlineCode', value: textOf(node) }];
      case 'br':
        return [{ type: 'break' }];
      case 'img': {
        const src = String(node.properties.src ?? '');
        if (!src) return [];
        this.images.add(src);
        return [{ type: 'image', src, alt: String(node.properties.alt ?? '') }];
      }
      case 'a':
        return node.properties.href != null ? this.link(String(node.properties.href), kids()) : kids();
      default:
        return kids();
    }
  }

  private link(href: string, children: Inline[]): Inline[] {
    if (SCHEME.test(href)) return [{ type: 'link', href, children }];
    const hash = href.indexOf('#');
    const path = decodeURIComponent(hash === -1 ? href : href.slice(0, hash));
    const anchor = hash === -1 ? undefined : decodeURIComponent(href.slice(hash + 1)) || undefined;
    if (IMAGE_FILE.test(path)) {
      this.images.add(path);
      return [{ type: 'link', href: `/image/${encodeURIComponent(path)}`, children }];
    }
    const slug = path || this.slug;
    this.links.push({ slug, anchor });
    return [{ type: 'link', href: `/chapter/${encodeURIComponent(slug)}${anchor ? `?anchor=${encodeURIComponent(anchor)}` : ''}`, children }];
  }

  private paragraph(run: Inline[]): Block[] {
    const content = run.filter((n) => !(n.type === 'text' && !n.value.trim()) && n.type !== 'break');
    if (!content.length) return [];
    if (content.every((n) => n.type === 'image')) {
      return (content as ImageInline[]).map((n) => ({ type: 'image', src: n.src, alt: n.alt }));
    }
    return [{ type: 'paragraph', children: trimInlines(run) }];
  }

  private collectAnchor(el: Element) {
    const id = el.properties.id ?? (el.tagName === 'a' && el.properties.href == null ? el.properties.name : undefined);
    if (id != null && id !== '') this.anchors.push(String(id));
  }
}

function trimInlines(nodes: Inline[]): Inline[] {
  const merged: Inline[] = [];
  for (const n of nodes) {
    const prev = merged[merged.length - 1];
    if (n.type === 'text' && prev?.type === 'text') merged[merged.length - 1] = { type: 'text', value: prev.value + n.value };
    else merged.push(n);
  }
  while (merged[0]?.type === 'break') merged.shift();
  while (merged[merged.length - 1]?.type === 'break') merged.pop();
  const first = merged[0];
  if (first?.type === 'text') merged[0] = { type: 'text', value: first.value.trimStart() };
  const lastIndex = merged.length - 1;
  const last = merged[lastIndex];
  if (last?.type === 'text') merged[lastIndex] = { type: 'text', value: last.value.trimEnd() };
  return merged.filter((n) => !(n.type === 'text' && n.value === ''));
}

export function convertMarkdown(slug: string, md: string): Converted {
  const tree = processor.runSync(processor.parse(md)) as Root;
  const c = new Converter(slug);
  const blocks: Block[] = [];
  const anchors: Record<string, number> = {};
  let pending: string[] = [];
  for (const node of tree.children) {
    const produced = c.blocks([node]);
    pending.push(...c.takeAnchors());
    if (!produced.length) continue;
    for (const a of pending) anchors[a] ??= blocks.length;
    pending = [];
    blocks.push(...produced);
  }
  for (const a of pending) anchors[a] ??= Math.max(blocks.length - 1, 0);
  return { chapter: { slug, blocks, anchors }, links: c.links, images: [...c.images] };
}
