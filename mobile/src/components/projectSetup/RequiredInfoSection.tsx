/**
 * RequiredInfoSection - add/edit/remove label:value rows.
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
import type { RequiredInfoRow } from './types';
import { sharedStyles } from './sharedStyles';

let _idCounter = 0;
function genId() { return `ri_${Date.now()}_${++_idCounter}`; }

interface Props {
  rows: RequiredInfoRow[];
  onChange: (rows: RequiredInfoRow[]) => void;
}

export function RequiredInfoSection({ rows, onChange }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => sharedStyles(colors), [colors]);

  const updateRow = useCallback((clientId: string, key: 'label' | 'value', val: string) => {
    onChange(rows.map((r) => r.clientId === clientId ? { ...r, [key]: val } : r));
  }, [rows, onChange]);

  const addRow = useCallback(() => {
    onChange([...rows, { clientId: genId(), label: '', value: '' }]);
  }, [rows, onChange]);

  const removeRow = useCallback((clientId: string) => {
    Alert.alert('Remove Row', 'Remove this information row?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => onChange(rows.filter((r) => r.clientId !== clientId)) },
    ]);
  }, [rows, onChange]);

  return (
    <View>
      {rows.length === 0 && (
        <Text style={[s.empty, { marginBottom: spacing.sm }]}>No rows yet. Add label/value pairs of required information.</Text>
      )}

      {rows.map((row, idx) => (
        <View key={row.clientId} style={{ flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm, alignItems: 'center' }}>
          <TextInput
            style={[s.input, { flex: 1 }]}
            value={row.label}
            onChangeText={(v) => updateRow(row.clientId, 'label', v)}
            placeholder="Label"
            placeholderTextColor={colors.mutedForeground}
            testID={`req-info-label-${idx}`}
          />
          <TextInput
            style={[s.input, { flex: 1 }]}
            value={row.value}
            onChangeText={(v) => updateRow(row.clientId, 'value', v)}
            placeholder="Value"
            placeholderTextColor={colors.mutedForeground}
            testID={`req-info-value-${idx}`}
          />
          <TouchableOpacity onPress={() => removeRow(row.clientId)} testID={`req-info-remove-${idx}`}>
            <Feather name="x" size={18} color={colors.destructive} />
          </TouchableOpacity>
        </View>
      ))}

      <TouchableOpacity style={s.addButton} onPress={addRow} testID="req-info-add-button">
        <Feather name="plus" size={16} color={colors.primary} />
        <Text style={s.addButtonText}>Add Row</Text>
      </TouchableOpacity>
    </View>
  );
}
