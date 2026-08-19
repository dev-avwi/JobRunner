/**
 * FinancialSettingsSection
 * Contract value, total budget, markups, retention, defects liability, payment terms, deposit %.
 */
import { useMemo } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useTheme } from '../../lib/theme';
import { spacing } from '../../lib/design-tokens';
import type { FinancialSettings } from './types';
import { sharedStyles } from './sharedStyles';

interface Props {
  settings: FinancialSettings;
  onChange: (s: FinancialSettings) => void;
}

export function FinancialSettingsSection({ settings, onChange }: Props) {
  const { colors } = useTheme();
  const s = useMemo(() => sharedStyles(colors), [colors]);

  function field(key: keyof FinancialSettings) {
    return (v: string) => onChange({ ...settings, [key]: v });
  }

  return (
    <View style={{ gap: spacing.md }}>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Contract Value ($)</Text>
          <TextInput
            style={s.input}
            value={settings.contractValue}
            onChangeText={field('contractValue')}
            placeholder="e.g. 250000"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
            testID="financial-contract-value"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Total Budget ($)</Text>
          <TextInput
            style={s.input}
            value={settings.totalBudget}
            onChangeText={field('totalBudget')}
            placeholder="e.g. 220000"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
            testID="financial-total-budget"
          />
        </View>
      </View>

      <Text style={[s.sectionSubtitle, { marginTop: spacing.xs }]}>Markup Overrides</Text>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Materials %</Text>
          <TextInput
            style={[s.input, { textAlign: 'center' }]}
            value={settings.materialMarkupPct}
            onChangeText={field('materialMarkupPct')}
            placeholder="20"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
            testID="financial-material-markup"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Equipment %</Text>
          <TextInput
            style={[s.input, { textAlign: 'center' }]}
            value={settings.equipmentMarkupPct}
            onChangeText={field('equipmentMarkupPct')}
            placeholder="15"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
            testID="financial-equipment-markup"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Subcon %</Text>
          <TextInput
            style={[s.input, { textAlign: 'center' }]}
            value={settings.subcontractorMarkupPct}
            onChangeText={field('subcontractorMarkupPct')}
            placeholder="10"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
            testID="financial-subcon-markup"
          />
        </View>
      </View>

      <Text style={[s.sectionSubtitle, { marginTop: spacing.xs }]}>Contract Terms</Text>
      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Retention %</Text>
          <TextInput
            style={s.input}
            value={settings.retentionPercent}
            onChangeText={field('retentionPercent')}
            placeholder="5"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
            testID="financial-retention"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Defects Liability (months)</Text>
          <TextInput
            style={s.input}
            value={settings.defectsLiabilityMonths}
            onChangeText={field('defectsLiabilityMonths')}
            placeholder="12"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="number-pad"
            testID="financial-defects-liability"
          />
        </View>
      </View>

      <View style={s.row}>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Payment Terms</Text>
          <TextInput
            style={s.input}
            value={settings.paymentTerms}
            onChangeText={field('paymentTerms')}
            placeholder="e.g. 30 days"
            placeholderTextColor={colors.mutedForeground}
            testID="financial-payment-terms"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={s.label}>Deposit %</Text>
          <TextInput
            style={s.input}
            value={settings.depositPercent}
            onChangeText={field('depositPercent')}
            placeholder="10"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="decimal-pad"
            testID="financial-deposit"
          />
        </View>
      </View>
    </View>
  );
}
