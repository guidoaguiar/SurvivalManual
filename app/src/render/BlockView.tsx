import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { images } from '@/content/images';
import { splitHighlights } from '@/search/highlight';
import type { Block, Inline } from '@/types/content';
import { useRenderCtx } from './RenderContext';

const HEADING_SCALE = { 1: 1.6, 2: 1.4, 3: 1.25, 4: 1.1, 5: 1, 6: 1 } as const;
const MONO = Platform.select({ ios: 'Menlo', default: 'monospace' });

export function BlockView({ block }: { block: Block }) {
  const c = useRenderCtx();
  const base = { fontSize: c.fontSize, lineHeight: c.fontSize * 1.5, color: c.colors.text };
  switch (block.type) {
    case 'heading': {
      const size = c.fontSize * HEADING_SCALE[block.depth];
      return (
        <Text accessibilityRole="header" style={[base, styles.heading, { fontSize: size, lineHeight: size * 1.3 }]}>
          <Inlines nodes={block.children} />
        </Text>
      );
    }
    case 'paragraph':
      return (
        <Text style={[base, styles.paragraph]}>
          <Inlines nodes={block.children} />
        </Text>
      );
    case 'list':
      return (
        <View style={styles.list}>
          {block.items.map((item, i) => (
            <View key={i} style={styles.listItem}>
              <Text style={[base, { width: c.fontSize * 2 }]}>{block.ordered ? `${block.start + i}.` : '•'}</Text>
              <View style={styles.flex}>
                {item.map((b, j) => (
                  <BlockView key={j} block={b} />
                ))}
              </View>
            </View>
          ))}
        </View>
      );
    case 'blockquote':
      return (
        <View style={[styles.quote, { borderLeftColor: c.colors.quoteBar }]}>
          {block.children.map((b, i) => (
            <BlockView key={i} block={b} />
          ))}
        </View>
      );
    case 'table':
      return (
        <ScrollView horizontal style={styles.tableScroll}>
          <View style={[styles.table, { borderColor: c.colors.border }]}>
            {block.rows.map((row, r) => (
              <View key={r} style={[styles.tr, r === 0 && block.header && { backgroundColor: c.colors.surface }]}>
                {row.map((cell, k) => (
                  <View key={k} style={[styles.td, { borderColor: c.colors.border }]}>
                    {cell.map((b, j) => (
                      <BlockView key={j} block={b} />
                    ))}
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      );
    case 'image':
      return <ImageBlock src={block.src} alt={block.alt} />;
    case 'code':
      return <Text style={[base, styles.code, { backgroundColor: c.colors.surface, fontFamily: MONO }]}>{block.value}</Text>;
    case 'thematicBreak':
      return <View style={[styles.hr, { backgroundColor: c.colors.border }]} />;
  }
}

function ImageBlock({ src, alt }: { src: string; alt: string }) {
  const c = useRenderCtx();
  const asset = images[src];
  if (!asset) return null;
  return (
    <Pressable accessibilityRole="imagebutton" accessibilityLabel={alt || src} onPress={() => c.onImage(src)} style={styles.figure}>
      {/* Figures are black line art; give them a light backing in dark themes. */}
      <Image source={asset.source} resizeMode="contain" style={[styles.image, { aspectRatio: asset.width / asset.height, maxWidth: asset.width }, c.colors.dark && styles.imageOnDark]} />
      {alt ? <Text style={[styles.caption, { color: c.colors.muted, fontSize: c.fontSize * 0.85 }]}>{alt}</Text> : null}
    </Pressable>
  );
}

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) => (
        <InlineView key={i} node={n} />
      ))}
    </>
  );
}

function InlineView({ node }: { node: Inline }) {
  const c = useRenderCtx();
  switch (node.type) {
    case 'text':
      return <Highlighted text={node.value} />;
    case 'strong':
      return (
        <Text style={styles.bold}>
          <Inlines nodes={node.children} />
        </Text>
      );
    case 'emphasis':
      return (
        <Text style={styles.italic}>
          <Inlines nodes={node.children} />
        </Text>
      );
    case 'delete':
      return (
        <Text style={styles.strike}>
          <Inlines nodes={node.children} />
        </Text>
      );
    case 'inlineCode':
      return <Text style={{ fontFamily: MONO }}>{node.value}</Text>;
    case 'break':
      return <Text>{'\n'}</Text>;
    case 'link':
      return (
        <Text accessibilityRole="link" style={[styles.link, { color: c.colors.accent }]} onPress={() => c.onLink(node.href)}>
          <Inlines nodes={node.children} />
        </Text>
      );
    case 'image':
      return (
        <Text accessibilityRole="link" style={[styles.link, { color: c.colors.accent }]} onPress={() => c.onImage(node.src)}>
          {`[${node.alt || node.src}]`}
        </Text>
      );
  }
}

function Highlighted({ text }: { text: string }) {
  const c = useRenderCtx();
  if (!c.terms.length) return <>{text}</>;
  return (
    <>
      {splitHighlights(text, c.terms).map((r, i) =>
        r.match ? (
          <Text key={i} testID="hl" style={{ backgroundColor: c.colors.highlight, color: c.colors.highlightText }}>
            {r.text}
          </Text>
        ) : (
          r.text
        ),
      )}
    </>
  );
}

const styles = StyleSheet.create({
  heading: { fontWeight: 'bold', marginTop: 16, marginBottom: 8 },
  paragraph: { marginBottom: 10 },
  list: { marginBottom: 10 },
  listItem: { flexDirection: 'row' },
  flex: { flex: 1 },
  quote: { borderLeftWidth: 4, paddingLeft: 12, marginBottom: 10 },
  tableScroll: { marginBottom: 12 },
  table: { borderWidth: StyleSheet.hairlineWidth },
  tr: { flexDirection: 'row' },
  td: { width: 180, padding: 6, borderWidth: StyleSheet.hairlineWidth },
  code: { padding: 8, marginBottom: 10 },
  hr: { height: StyleSheet.hairlineWidth, marginVertical: 16 },
  figure: { marginBottom: 12, alignItems: 'center' },
  image: { width: '100%' },
  imageOnDark: { backgroundColor: '#ffffff', borderRadius: 4 },
  caption: { marginTop: 4, textAlign: 'center' },
  bold: { fontWeight: 'bold' },
  italic: { fontStyle: 'italic' },
  strike: { textDecorationLine: 'line-through' },
  link: { textDecorationLine: 'underline' },
});
