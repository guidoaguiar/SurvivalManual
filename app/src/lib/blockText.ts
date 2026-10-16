import type { Block, Inline } from '@/types/content';

export function inlineText(nodes: Inline[]): string {
  return nodes
    .map((n) => {
      switch (n.type) {
        case 'text':
        case 'inlineCode':
          return n.value;
        case 'break':
          return '\n';
        case 'image':
          return n.alt;
        default:
          return inlineText(n.children);
      }
    })
    .join('');
}

export function blockText(block: Block): string {
  switch (block.type) {
    case 'heading':
    case 'paragraph':
      return inlineText(block.children);
    case 'list':
      return block.items.map((item) => item.map(blockText).join('\n')).join('\n');
    case 'blockquote':
      return block.children.map(blockText).join('\n');
    case 'table':
      return block.rows.map((row) => row.map((cell) => cell.map(blockText).join(' ')).join(' | ')).join('\n');
    case 'image':
      return block.alt;
    case 'code':
      return block.value;
    case 'thematicBreak':
      return '';
  }
}
