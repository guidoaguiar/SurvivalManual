export type Inline =
  | { type: 'text'; value: string }
  | { type: 'inlineCode'; value: string }
  | { type: 'emphasis' | 'strong' | 'delete'; children: Inline[] }
  | { type: 'link'; href: string; children: Inline[] }
  | { type: 'image'; src: string; alt: string }
  | { type: 'break' };

export type Block =
  | { type: 'heading'; depth: 1 | 2 | 3 | 4 | 5 | 6; anchor?: string; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'list'; ordered: boolean; start: number; items: Block[][] }
  | { type: 'blockquote'; children: Block[] }
  | { type: 'table'; header: boolean; rows: Block[][][] }
  | { type: 'image'; src: string; alt: string }
  | { type: 'code'; value: string }
  | { type: 'thematicBreak' };

export type Chapter = { slug: string; blocks: Block[]; anchors: Record<string, number> };

export type ImageAsset = { source: number; width: number; height: number };

export type SearchDoc = { id: string; slug: string; block: number; heading: string; body: string };
