/**
 * MarkdownToolbar – formatting toolbar for markdown TextInput fields.
 * Pure logic lives in ../lib/markdownEditor (testable without native deps).
 */
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../lib/theme';
import { applyMarkdownAction } from '../lib/markdownEditor';

// Re-export types and the action function so callers can import from here.
export type { MarkdownAction } from '../lib/markdownEditor';
export { applyMarkdownAction } from '../lib/markdownEditor';

interface Props {
  value: string;
  selection: { start: number; end: number };
  onChange: (next: string) => void;
}

const BUTTONS: { action: string; label: string; title: string }[] = [
  { action: 'h2',       label: 'H2',  title: 'Heading 2' },
  { action: 'h3',       label: 'H3',  title: 'Heading 3' },
  { action: 'bullet',   label: '•—',  title: 'Bullet list' },
  { action: 'numbered', label: '1.—', title: 'Numbered list' },
  { action: 'bold',     label: 'B',   title: 'Bold' },
  { action: 'italic',   label: 'I',   title: 'Italic' },
];

export function MarkdownToolbar({ value, selection, onChange }: Props) {
  const { colors } = useTheme();

  const s = StyleSheet.create({
    row: {
      flexDirection: 'row',
      borderTopWidth: 1,
      borderBottomWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.muted,
      paddingHorizontal: 4,
      paddingVertical: 4,
      gap: 2,
    },
    btn: {
      minWidth: 36,
      height: 30,
      borderRadius: 5,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 6,
    },
    label: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.foreground,
    },
    labelItalic: {
      fontStyle: 'italic',
    },
  });

  return (
    <View style={s.row}>
      {BUTTONS.map(({ action, label, title }) => (
        <TouchableOpacity
          key={action}
          style={s.btn}
          onPress={() => onChange(applyMarkdownAction(value, selection, action as any))}
          hitSlop={4}
          accessibilityLabel={title}
        >
          <Text style={[s.label, action === 'italic' && s.labelItalic]}>{label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
