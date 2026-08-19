/**
 * ChecklistSection - add/remove/edit checklist items.
 */
import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Alert } from '@/lib/alert';
import { useTheme } from '../../lib/theme';
import { spacing } from '../../lib/design-tokens';
import type { ChecklistItem } from './types';
import { sharedStyles } from './sharedStyles';

let _idCounter = 0;
function genId() { return `cl_${Date.now()}_${++_idCounter}`; }

interface Props {
  items: ChecklistItem[];
  onChange: (items: ChecklistItem[]) => void;
}

export function ChecklistSection({ items, onChange }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => sharedStyles(colors), [colors]);
  const [newTitle, setNewTitle] = useState('');

  const addItem = useCallback(() => {
    const title = newTitle.trim();
    if (!title) { Alert.alert('Validation', 'Item title is required'); return; }
    onChange([...items, { clientId: genId(), title }]);
    setNewTitle('');
  }, [newTitle, items, onChange]);

  const updateItem = useCallback((clientId: string, title: string) => {
    onChange(items.map((it) => it.clientId === clientId ? { ...it, title } : it));
  }, [items, onChange]);

  const removeItem = useCallback((clientId: string) => {
    Alert.alert('Remove Item', 'Remove this checklist item?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onChange(items.filter((it) => it.clientId !== clientId)) },
    ]);
  }, [items, onChange]);

  return (
    <View>
      {items.length === 0 && (
        <Text style={[s.empty, { marginBottom: spacing.sm }]}>No checklist items yet.</Text>
      )}

      {items.map((item, idx) => (
        <View key={item.clientId} style={[s.itemCard, { marginBottom: spacing.sm }]}>
          <Feather name="check-square" size={16} color={colors.mutedForeground} />
          <TextInput
            style={[s.itemTitle, { flex: 1, paddingVertical: 0 }]}
            value={item.title}
            onChangeText={(v) => updateItem(item.clientId, v)}
            placeholder="Checklist item"
            placeholderTextColor={colors.mutedForeground}
            testID={`checklist-item-${idx}`}
          />
          <TouchableOpacity onPress={() => removeItem(item.clientId)} testID={`checklist-remove-${idx}`}>
            <Feather name="x" size={16} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      ))}

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <TextInput
          style={[s.input, { flex: 1 }]}
          value={newTitle}
          onChangeText={setNewTitle}
          placeholder="New checklist item..."
          placeholderTextColor={colors.mutedForeground}
          onSubmitEditing={addItem}
          returnKeyType="done"
          testID="checklist-new-item"
        />
        <TouchableOpacity
          style={[s.addButton, { paddingHorizontal: spacing.md, borderStyle: 'solid' }]}
          onPress={addItem}
          testID="checklist-add-button"
        >
          <Feather name="plus" size={18} color={colors.primary} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
