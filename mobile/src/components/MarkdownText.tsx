/**
 * MarkdownText – lightweight markdown renderer for React Native.
 * Supports: ## H2, ### H3, - bullets, 1. numbered, **bold**, *italic*, _italic_,
 * ![alt](url) images. Plain text falls through as-is.
 */
import { Text, View, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '../lib/theme';

type Segment = { text: string; bold?: boolean; italic?: boolean };

function parseInline(raw: string): Segment[] {
  const segments: Segment[] = [];
  // Tokenise **bold** and *italic* / _italic_
  const regex = /\*\*(.*?)\*\*|\*(.*?)\*|_(.*?)_/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(raw)) !== null) {
    if (m.index > last) segments.push({ text: raw.slice(last, m.index) });
    if (m[1] !== undefined) segments.push({ text: m[1], bold: true });
    else if (m[2] !== undefined) segments.push({ text: m[2], italic: true });
    else if (m[3] !== undefined) segments.push({ text: m[3], italic: true });
    last = m.index + m[0].length;
  }
  if (last < raw.length) segments.push({ text: raw.slice(last) });
  return segments;
}

interface Props {
  children: string;
  style?: any;
  numberOfLines?: number;
}

export function MarkdownText({ children, style, numberOfLines }: Props) {
  const { colors } = useTheme();

  if (!children) return null;

  // If content has no markdown syntax and no newlines, render as-is quickly
  const hasMarkdown = /^#{1,3} |^\s*[-*] |\d+\. |\*\*|\*|_|!\[/.test(children) || children.includes('\n');
  if (!hasMarkdown) {
    return <Text style={[{ color: colors.foreground }, style]} numberOfLines={numberOfLines}>{children}</Text>;
  }

  // Multi-line / block rendering
  const lines = children.split('\n');

  const s = StyleSheet.create({
    h2: { fontSize: 16, fontWeight: '700', color: colors.foreground, marginTop: 6, marginBottom: 2 },
    h3: { fontSize: 14, fontWeight: '600', color: colors.foreground, marginTop: 4, marginBottom: 1 },
    bulletRow: { flexDirection: 'row', marginVertical: 1 },
    bullet: { color: colors.secondaryText, marginRight: 6, fontSize: 13, lineHeight: 20 },
    body: { fontSize: 13, color: colors.secondaryText, lineHeight: 20, flex: 1 },
    plain: { fontSize: 13, color: colors.secondaryText, lineHeight: 20 },
    bold: { fontWeight: '700' },
    italic: { fontStyle: 'italic' },
  });

  const renderInline = (text: string, baseStyle?: any) => {
    const segs = parseInline(text);
    if (segs.length === 1 && !segs[0].bold && !segs[0].italic) {
      return <Text style={[s.body, baseStyle]}>{segs[0].text}</Text>;
    }
    return (
      <Text style={[s.body, baseStyle]}>
        {segs.map((seg, i) => (
          <Text
            key={i}
            style={[seg.bold && s.bold, seg.italic && s.italic]}
          >
            {seg.text}
          </Text>
        ))}
      </Text>
    );
  };

  // For numberOfLines hint — collapse to plain preview
  if (numberOfLines) {
    const plain = children
      .replace(/^#{1,3} /gm, '')
      .replace(/^\s*[-*] /gm, '• ')
      .replace(/\d+\. /g, '')
      .replace(/\*\*(.*?)\*\*/g, '$1')
      .replace(/\*(.*?)\*/g, '$1')
      .replace(/_(.*?)_/g, '$1');
    return (
      <Text style={[s.plain, style]} numberOfLines={numberOfLines}>
        {plain}
      </Text>
    );
  }

  let numberedCount = 0;

  return (
    <View style={style}>
      {lines.map((line, idx) => {
        const h2 = line.match(/^## (.+)/);
        if (h2) {
          numberedCount = 0;
          return <Text key={idx} style={s.h2}>{h2[1]}</Text>;
        }
        const h3 = line.match(/^### (.+)/);
        if (h3) {
          numberedCount = 0;
          return <Text key={idx} style={s.h3}>{h3[1]}</Text>;
        }
        const img = line.match(/^!\[([^\]]*)\]\(([^)]+)\)/);
        if (img) {
          numberedCount = 0;
          return <Image key={idx} source={{ uri: img[2] }} style={{ width: '100%', height: 180, borderRadius: 6, marginVertical: 4 }} />;
        }
        const bullet = line.match(/^\s*[-*] (.+)/);
        if (bullet) {
          numberedCount = 0;
          return (
            <View key={idx} style={s.bulletRow}>
              <Text style={s.bullet}>•</Text>
              {renderInline(bullet[1])}
            </View>
          );
        }
        const numbered = line.match(/^\d+\. (.+)/);
        if (numbered) {
          numberedCount++;
          const n = numberedCount;
          return (
            <View key={idx} style={s.bulletRow}>
              <Text style={[s.bullet, { minWidth: 18 }]}>{n}.</Text>
              {renderInline(numbered[1])}
            </View>
          );
        }
        numberedCount = 0;
        if (line.trim() === '') {
          return <View key={idx} style={{ height: 6 }} />;
        }
        return <View key={idx}>{renderInline(line)}</View>;
      })}
    </View>
  );
}
