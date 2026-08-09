import { useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Share,
} from 'react-native';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, pageShell, iconSizes, sizes, fontWeights } from '../../src/lib/design-tokens';
import { useAuthStore } from '../../src/lib/store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';

type CalculatorId = 'baluster' | 'concrete' | 'tile' | 'paint' | 'roof' | 'pipe_sizing' | 'water_flow' | 'drain_fall';

interface CalculatorInfo {
  id: CalculatorId;
  name: string;
  description: string;
  icon: keyof typeof Feather.glyphMap;
  category: string;
  categoryColor: string;
  trades: string[];
}

const PLUMBING_COLOR = '#0891b2';

const calculators: CalculatorInfo[] = [
  {
    id: 'pipe_sizing',
    name: 'Pipe Sizing',
    description: 'Calculate pipe diameter from flow rate and velocity for water supply systems',
    icon: 'circle',
    category: 'Plumbing',
    categoryColor: PLUMBING_COLOR,
    trades: ['plumbing', 'plumber', 'gasfitting'],
  },
  {
    id: 'water_flow',
    name: 'Water Flow Rate',
    description: 'Calculate GPM/LPM flow rate from pipe size and pressure (Hazen-Williams)',
    icon: 'activity',
    category: 'Plumbing',
    categoryColor: PLUMBING_COLOR,
    trades: ['plumbing', 'plumber', 'gasfitting'],
  },
  {
    id: 'drain_fall',
    name: 'Drain Fall / Gradient',
    description: 'Calculate minimum fall and grade for drainage pipes (AS/NZS 3500 compliant)',
    icon: 'trending-down',
    category: 'Plumbing',
    categoryColor: PLUMBING_COLOR,
    trades: ['plumbing', 'plumber', 'gasfitting', 'drainage'],
  },
  {
    id: 'baluster',
    name: 'Baluster Spacing',
    description: 'Calculate baluster count and gap spacing for decks and stair rails (AU compliant 100mm max)',
    icon: 'maximize',
    category: 'Building',
    categoryColor: '#d97706',
    trades: ['building', 'carpentry', 'carpenter', 'builder', 'decking'],
  },
  {
    id: 'concrete',
    name: 'Concrete Volume',
    description: 'Calculate cubic meters and premix bags needed for slabs, footings, and pads',
    icon: 'square',
    category: 'Building',
    categoryColor: '#d97706',
    trades: ['building', 'builder', 'concrete', 'landscaping'],
  },
  {
    id: 'tile',
    name: 'Tile Quantity',
    description: 'Calculate tile count with wastage for floors and walls',
    icon: 'grid',
    category: 'Tiling',
    categoryColor: '#059669',
    trades: ['tiling', 'tiler', 'bathroom'],
  },
  {
    id: 'paint',
    name: 'Paint Coverage',
    description: 'Calculate paint needed for walls with door/window exclusions',
    icon: 'droplet',
    category: 'Painting',
    categoryColor: '#7c3aed',
    trades: ['painting', 'painter', 'decorator'],
  },
  {
    id: 'roof',
    name: 'Roof Pitch',
    description: 'Calculate pitch angle, ratio, and roof area from rise and run measurements',
    icon: 'home',
    category: 'Building',
    categoryColor: '#d97706',
    trades: ['building', 'roofing', 'roofer', 'builder', 'carpentry'],
  },
];

const createStyles = (colors: any, bottomNavHeight: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  contentContainer: {
    paddingHorizontal: pageShell.paddingHorizontal,
    paddingTop: pageShell.paddingTop,
    paddingBottom: bottomNavHeight,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageTitle: {
    ...typography.largeTitle,
    color: colors.foreground,
  },
  pageSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  sectionLabel: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    marginTop: spacing.md,
  },
  calcCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  calcIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  calcContent: {
    flex: 1,
  },
  calcName: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  calcDescription: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  calcPreview: {
    ...typography.captionSmall,
    color: colors.primary,
    fontWeight: fontWeights.semibold,
    marginTop: spacing.xs,
  },
  categoryBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
  },
  categoryBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.semibold,
  },
  recommendedBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    marginLeft: spacing.sm,
  },
  recommendedBadgeText: {
    fontSize: typography.sizes.xs,
    fontWeight: fontWeights.bold,
  },
  chevron: {
    marginLeft: spacing.sm,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.lg,
    paddingTop: spacing.sm,
  },
  backButtonText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: fontWeights.medium,
  },
  calcDetailCard: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  calcDetailHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  calcDetailTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  calcDetailSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  formulaBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
    backgroundColor: colors.muted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  formulaLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    fontWeight: fontWeights.semibold,
    marginBottom: 2,
  },
  formulaText: {
    ...typography.caption,
    color: colors.foreground,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    flex: 1,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.lg,
  },
  infoText: {
    ...typography.caption,
    flex: 1,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.body,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  inputHint: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  textInput: {
    height: sizes.inputHeight,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    ...typography.body,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
  },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inputRowItem: {
    flex: 1,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.muted,
    padding: spacing.md,
    borderRadius: radius.lg,
    marginBottom: spacing.md,
  },
  switchLabel: {
    ...typography.body,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  switchHint: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  calculateButton: {
    flex: 1,
    height: sizes.inputHeight,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calculateButtonDisabled: {
    opacity: 0.5,
  },
  calculateButtonText: {
    ...typography.button,
    color: colors.primaryForeground,
  },
  resetButton: {
    height: sizes.inputHeight,
    paddingHorizontal: spacing.xl,
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  resetButtonText: {
    ...typography.button,
    color: colors.foreground,
  },
  resultsCard: {
    backgroundColor: colors.card,
    borderRadius: radius['2xl'],
    padding: spacing.lg,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    ...shadows.sm,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  resultsTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
  },
  shareButtonText: {
    ...typography.captionSmall,
    color: colors.primary,
    fontWeight: fontWeights.semibold,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  resultRowLast: {
    borderBottomWidth: 0,
  },
  resultLabel: {
    ...typography.body,
    color: colors.mutedForeground,
  },
  resultValue: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  resultHighlight: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  resultHighlightText: {
    ...typography.body,
    fontWeight: fontWeights.bold,
    color: colors.primary,
  },
  segmentRow: {
    flexDirection: 'row',
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: 2,
    marginBottom: spacing.md,
  },
  segmentButton: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  segmentButtonActive: {
    backgroundColor: colors.card,
    ...shadows.sm,
  },
  segmentButtonText: {
    ...typography.caption,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
  },
  segmentButtonTextActive: {
    color: colors.foreground,
    fontWeight: fontWeights.semibold,
  },
  wastageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  wastageLabel: {
    ...typography.body,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  wastageValue: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.primary,
  },
  wastageButtons: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  wastageButton: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
  },
  wastageButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  wastageButtonText: {
    ...typography.caption,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
  },
  wastageButtonTextActive: {
    color: colors.primary,
    fontWeight: fontWeights.semibold,
  },
  tileSizeButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.muted,
    marginRight: spacing.sm,
    marginBottom: spacing.sm,
  },
  tileSizeButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  tileSizeButtonText: {
    ...typography.caption,
    fontWeight: fontWeights.medium,
    color: colors.mutedForeground,
  },
  tileSizeButtonTextActive: {
    color: colors.primary,
    fontWeight: fontWeights.semibold,
  },
  tileSizeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: spacing.md,
  },
  costEstimate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.muted,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  costLabel: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
  },
  costValue: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
});

function FormulaBox({ formula, label, colors, styles }: { formula: string; label?: string; colors: any; styles: any }) {
  return (
    <View style={styles.formulaBox}>
      <Feather name="code" size={iconSizes.sm} color={colors.mutedForeground} style={{ marginTop: 2 }} />
      <View style={{ flex: 1 }}>
        {label && <Text style={styles.formulaLabel}>{label}</Text>}
        <Text style={styles.formulaText}>{formula}</Text>
      </View>
    </View>
  );
}

function ShareResultsButton({ title, results, styles }: { title: string; results: { label: string; value: string }[]; styles: any }) {
  const handleShare = useCallback(async () => {
    const text = `${title}\n${'—'.repeat(20)}\n${results.map(r => `${r.label}: ${r.value}`).join('\n')}\n\nCalculated with JobRunner`;
    try {
      await Share.share({ message: text, title });
    } catch (err) {
      console.warn('Failed to share calculator results:', err);
    }
  }, [title, results]);

  return (
    <PressableRow style={styles.shareButton} onPress={handleShare}>
      <Feather name="share-2" size={iconSizes.sm} color={styles.shareButtonText.color} />
      <Text style={styles.shareButtonText}>Share</Text>
    </PressableRow>
  );
}

function ResultsCardWithShare({ title, shareData, children, styles }: { title: string; shareData: { label: string; value: string }[]; children: React.ReactNode; styles: any }) {
  return (
    <View style={styles.resultsCard}>
      <View style={styles.resultsHeader}>
        <Text style={styles.resultsTitle}>{title}</Text>
        <ShareResultsButton title={title} results={shareData} styles={styles} />
      </View>
      {children}
    </View>
  );
}

function PipeSizingCalculator({ colors, styles, onResult }: { colors: any; styles: any; onResult: (preview: string) => void }) {
  const [flowRate, setFlowRate] = useState('');
  const [velocity, setVelocity] = useState('1.5');
  const [calculated, setCalculated] = useState(false);

  const results = useMemo(() => {
    const q = parseFloat(flowRate);
    const v = parseFloat(velocity);
    if (!q || !v || q <= 0 || v <= 0) return null;

    const qM3s = q / 1000;
    const areaM2 = qM3s / v;
    const diameterM = Math.sqrt((4 * areaM2) / Math.PI);
    const diameterMm = diameterM * 1000;

    const standardSizes = [15, 20, 25, 32, 40, 50, 65, 80, 100, 150, 200];
    const recommended = standardSizes.find(s => s >= diameterMm) || standardSizes[standardSizes.length - 1];

    const actualArea = Math.PI * Math.pow(recommended / 2000, 2);
    const actualVelocity = qM3s / actualArea;

    return {
      calculatedDiameter: diameterMm.toFixed(1),
      recommendedSize: recommended,
      actualVelocity: actualVelocity.toFixed(2),
      crossSectionArea: (areaM2 * 10000).toFixed(2),
    };
  }, [flowRate, velocity]);

  const handleCalculate = () => {
    if (results) {
      setCalculated(true);
      onResult(`DN${results.recommendedSize} pipe`);
    }
  };

  const handleReset = () => {
    setFlowRate(''); setVelocity('1.5'); setCalculated(false);
  };

  const shareData = results ? [
    { label: 'Calculated Diameter', value: `${results.calculatedDiameter} mm` },
    { label: 'Recommended Pipe', value: `DN${results.recommendedSize}` },
    { label: 'Actual Velocity', value: `${results.actualVelocity} m/s` },
    { label: 'Cross-Section Area', value: `${results.crossSectionArea} cm²` },
  ] : [];

  return (
    <>
      <View style={styles.calcDetailCard}>
        <View style={styles.calcDetailHeader}>
          <View style={[styles.calcIconContainer, { backgroundColor: PLUMBING_COLOR + '20' }]}>
            <Feather name="circle" size={iconSizes.xl} color={PLUMBING_COLOR} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.calcDetailTitle}>Pipe Sizing</Text>
            <Text style={styles.calcDetailSubtitle}>Calculate pipe diameter from flow rate and velocity</Text>
          </View>
        </View>

        <FormulaBox
          label="Formula"
          formula="D = sqrt( (4 × Q) / (π × V) )"
          colors={colors}
          styles={styles}
        />

        <View style={[styles.infoBox, { backgroundColor: PLUMBING_COLOR + '15' }]}>
          <Feather name="info" size={iconSizes.md} color={PLUMBING_COLOR} style={{ marginTop: 2 }} />
          <Text style={[styles.infoText, { color: PLUMBING_COLOR }]}>
            Recommended velocity: 1.0-2.0 m/s for cold water, 0.8-1.5 m/s for hot water. Results suggest nearest standard AS pipe size.
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Flow Rate (L/s)</Text>
          <TextInput
            style={styles.textInput}
            value={flowRate}
            onChangeText={(v) => { setFlowRate(v); setCalculated(false); }}
            placeholder="e.g., 0.5"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
          />
          <Text style={styles.inputHint}>Total demand in litres per second</Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Design Velocity (m/s)</Text>
          <TextInput
            style={styles.textInput}
            value={velocity}
            onChangeText={(v) => { setVelocity(v); setCalculated(false); }}
            placeholder="1.5"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
          />
          <Text style={styles.inputHint}>Typical: 1.5 m/s for mains supply</Text>
        </View>

        <View style={styles.buttonRow}>
          <PressableRow style={[styles.calculateButton, !results && styles.calculateButtonDisabled]} onPress={handleCalculate} disabled={!results}>
            <Text style={styles.calculateButtonText}>Calculate</Text>
          </PressableRow>
          <PressableRow style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </PressableRow>
        </View>
      </View>

      {calculated && results && (
        <ResultsCardWithShare title="Pipe Sizing Results" shareData={shareData} styles={styles}>
          <ResultRow label="Recommended Pipe" value={`DN${results.recommendedSize}`} highlight styles={styles} />
          <ResultRow label="Calculated Diameter" value={`${results.calculatedDiameter} mm`} styles={styles} />
          <ResultRow label="Actual Velocity" value={`${results.actualVelocity} m/s`} styles={styles} />
          <ResultRow label="Cross-Section Area" value={`${results.crossSectionArea} cm²`} last styles={styles} />
        </ResultsCardWithShare>
      )}
    </>
  );
}

function WaterFlowCalculator({ colors, styles, onResult }: { colors: any; styles: any; onResult: (preview: string) => void }) {
  const [pipeDiameter, setPipeDiameter] = useState('');
  const [pressure, setPressure] = useState('');
  const [pipeLength, setPipeLength] = useState('');
  const [cFactor, setCFactor] = useState('150');
  const [calculated, setCalculated] = useState(false);

  const results = useMemo(() => {
    const d = parseFloat(pipeDiameter);
    const p = parseFloat(pressure);
    const l = parseFloat(pipeLength);
    const c = parseFloat(cFactor);
    if (!d || !p || !l || !c || d <= 0 || p <= 0 || l <= 0 || c <= 0) return null;

    const dMetres = d / 1000;
    const headLoss = p * 10.197;
    const slope = headLoss / l;
    const velocityFactor = 0.8492 * c * Math.pow(dMetres / 4, 0.63) * Math.pow(slope, 0.54);
    const area = Math.PI * Math.pow(dMetres / 2, 2);
    const flowM3s = velocityFactor * area;
    const flowLps = flowM3s * 1000;
    const flowLpm = flowLps * 60;
    const flowGpm = flowLpm * 0.264172;

    return {
      flowLps: flowLps.toFixed(2),
      flowLpm: flowLpm.toFixed(1),
      flowGpm: flowGpm.toFixed(1),
      velocity: velocityFactor.toFixed(2),
      headLossPerM: (slope).toFixed(4),
    };
  }, [pipeDiameter, pressure, pipeLength, cFactor]);

  const handleCalculate = () => {
    if (results) {
      setCalculated(true);
      onResult(`${results.flowLpm} L/min`);
    }
  };

  const handleReset = () => {
    setPipeDiameter(''); setPressure(''); setPipeLength(''); setCFactor('150'); setCalculated(false);
  };

  const shareData = results ? [
    { label: 'Flow Rate', value: `${results.flowLpm} L/min` },
    { label: 'Flow Rate (L/s)', value: `${results.flowLps} L/s` },
    { label: 'Flow Rate (GPM)', value: `${results.flowGpm} GPM` },
    { label: 'Velocity', value: `${results.velocity} m/s` },
  ] : [];

  return (
    <>
      <View style={styles.calcDetailCard}>
        <View style={styles.calcDetailHeader}>
          <View style={[styles.calcIconContainer, { backgroundColor: PLUMBING_COLOR + '20' }]}>
            <Feather name="activity" size={iconSizes.xl} color={PLUMBING_COLOR} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.calcDetailTitle}>Water Flow Rate</Text>
            <Text style={styles.calcDetailSubtitle}>Hazen-Williams flow calculation</Text>
          </View>
        </View>

        <FormulaBox
          label="Hazen-Williams Formula"
          formula="V = 0.849 × C × (D/4)^0.63 × S^0.54"
          colors={colors}
          styles={styles}
        />

        <View style={[styles.infoBox, { backgroundColor: PLUMBING_COLOR + '15' }]}>
          <Feather name="info" size={iconSizes.md} color={PLUMBING_COLOR} style={{ marginTop: 2 }} />
          <Text style={[styles.infoText, { color: PLUMBING_COLOR }]}>
            C-factor: 150 for new copper/PEX, 140 for new steel, 120 for aged pipes. Pressure in bar.
          </Text>
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputRowItem}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Pipe Diameter (mm)</Text>
              <TextInput style={styles.textInput} value={pipeDiameter} onChangeText={(v) => { setPipeDiameter(v); setCalculated(false); }} placeholder="e.g., 25" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
              <Text style={styles.inputHint}>Internal diameter</Text>
            </View>
          </View>
          <View style={styles.inputRowItem}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Pressure (bar)</Text>
              <TextInput style={styles.textInput} value={pressure} onChangeText={(v) => { setPressure(v); setCalculated(false); }} placeholder="e.g., 3.5" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
              <Text style={styles.inputHint}>Available pressure</Text>
            </View>
          </View>
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputRowItem}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Pipe Length (m)</Text>
              <TextInput style={styles.textInput} value={pipeLength} onChangeText={(v) => { setPipeLength(v); setCalculated(false); }} placeholder="e.g., 30" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
            </View>
          </View>
          <View style={styles.inputRowItem}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>C-Factor</Text>
              <TextInput style={styles.textInput} value={cFactor} onChangeText={(v) => { setCFactor(v); setCalculated(false); }} placeholder="150" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
              <Text style={styles.inputHint}>Pipe roughness</Text>
            </View>
          </View>
        </View>

        <View style={styles.buttonRow}>
          <PressableRow style={[styles.calculateButton, !results && styles.calculateButtonDisabled]} onPress={handleCalculate} disabled={!results}>
            <Text style={styles.calculateButtonText}>Calculate</Text>
          </PressableRow>
          <PressableRow style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </PressableRow>
        </View>
      </View>

      {calculated && results && (
        <ResultsCardWithShare title="Flow Rate Results" shareData={shareData} styles={styles}>
          <ResultRow label="Flow Rate" value={`${results.flowLpm} L/min`} highlight styles={styles} />
          <ResultRow label="Flow Rate (L/s)" value={`${results.flowLps} L/s`} styles={styles} />
          <ResultRow label="Flow Rate (GPM)" value={`${results.flowGpm} GPM`} styles={styles} />
          <ResultRow label="Velocity" value={`${results.velocity} m/s`} styles={styles} />
          <ResultRow label="Head Loss/m" value={`${results.headLossPerM} m/m`} last styles={styles} />
        </ResultsCardWithShare>
      )}
    </>
  );
}

function DrainFallCalculator({ colors, styles, onResult }: { colors: any; styles: any; onResult: (preview: string) => void }) {
  const [pipeSize, setPipeSize] = useState('100');
  const [runLength, setRunLength] = useState('');
  const [drainType, setDrainType] = useState<'sewer' | 'stormwater'>('sewer');
  const [calculated, setCalculated] = useState(false);

  const drainGrades: Record<string, Record<string, number>> = {
    sewer: { '40': 2.5, '50': 2.0, '65': 1.65, '80': 1.65, '100': 1.65, '150': 1.0, '225': 0.8 },
    stormwater: { '50': 1.67, '65': 1.33, '80': 1.0, '90': 1.0, '100': 1.0, '150': 0.67, '225': 0.5 },
  };

  const results = useMemo(() => {
    const length = parseFloat(runLength);
    if (!length || length <= 0) return null;

    const grades = drainGrades[drainType];
    const minGrade = grades[pipeSize];
    if (!minGrade) return null;

    const totalFall = (minGrade / 100) * length;
    const ratio = `1:${Math.round(100 / minGrade)}`;

    return {
      minGrade: minGrade.toFixed(2),
      totalFall: totalFall.toFixed(0),
      totalFallM: (totalFall / 1000).toFixed(3),
      ratio,
      pipeSize,
      drainType: drainType === 'sewer' ? 'Sewer/Sanitary' : 'Stormwater',
    };
  }, [pipeSize, runLength, drainType]);

  const handleCalculate = () => {
    if (results) {
      setCalculated(true);
      onResult(`${results.minGrade}% grade, ${results.totalFall}mm fall`);
    }
  };

  const handleReset = () => {
    setPipeSize('100'); setRunLength(''); setDrainType('sewer'); setCalculated(false);
  };

  const shareData = results ? [
    { label: 'Minimum Grade', value: `${results.minGrade}%` },
    { label: 'Total Fall', value: `${results.totalFall} mm (${results.totalFallM} m)` },
    { label: 'Gradient Ratio', value: results.ratio },
    { label: 'Pipe Size', value: `DN${results.pipeSize}` },
    { label: 'Drain Type', value: results.drainType },
  ] : [];

  const availableSizes = Object.keys(drainGrades[drainType]);

  return (
    <>
      <View style={styles.calcDetailCard}>
        <View style={styles.calcDetailHeader}>
          <View style={[styles.calcIconContainer, { backgroundColor: PLUMBING_COLOR + '20' }]}>
            <Feather name="trending-down" size={iconSizes.xl} color={PLUMBING_COLOR} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.calcDetailTitle}>Drain Fall / Gradient</Text>
            <Text style={styles.calcDetailSubtitle}>Minimum fall per AS/NZS 3500</Text>
          </View>
        </View>

        <FormulaBox
          label="Formula"
          formula="Total Fall = (Grade% / 100) × Run Length"
          colors={colors}
          styles={styles}
        />

        <View style={[styles.infoBox, { backgroundColor: PLUMBING_COLOR + '15' }]}>
          <Feather name="info" size={iconSizes.md} color={PLUMBING_COLOR} style={{ marginTop: 2 }} />
          <Text style={[styles.infoText, { color: PLUMBING_COLOR }]}>
            Grades based on AS/NZS 3500.2 (sanitary) and AS/NZS 3500.3 (stormwater). Always check local authority requirements.
          </Text>
        </View>

        <Text style={styles.inputLabel}>Drain Type</Text>
        <View style={styles.segmentRow}>
          <PressableRow style={[styles.segmentButton, drainType === 'sewer' && styles.segmentButtonActive]} onPress={() => { setDrainType('sewer'); setCalculated(false); }} >
            <Text style={[styles.segmentButtonText, drainType === 'sewer' && styles.segmentButtonTextActive]}>Sewer / Sanitary</Text>
          </PressableRow>
          <PressableRow style={[styles.segmentButton, drainType === 'stormwater' && styles.segmentButtonActive]} onPress={() => { setDrainType('stormwater'); setCalculated(false); }} >
            <Text style={[styles.segmentButtonText, drainType === 'stormwater' && styles.segmentButtonTextActive]}>Stormwater</Text>
          </PressableRow>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Pipe Size (DN)</Text>
          <View style={styles.tileSizeGrid}>
            {availableSizes.map(size => (
              <PressableRow key={size} style={[styles.tileSizeButton, pipeSize === size && styles.tileSizeButtonActive]} onPress={() => { setPipeSize(size); setCalculated(false); }} >
                <Text style={[styles.tileSizeButtonText, pipeSize === size && styles.tileSizeButtonTextActive]}>DN{size}</Text>
              </PressableRow>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Run Length (m)</Text>
          <TextInput
            style={styles.textInput}
            value={runLength}
            onChangeText={(v) => { setRunLength(v); setCalculated(false); }}
            placeholder="e.g., 15"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
          />
          <Text style={styles.inputHint}>Horizontal distance of drain run</Text>
        </View>

        <View style={styles.buttonRow}>
          <PressableRow style={[styles.calculateButton, !results && styles.calculateButtonDisabled]} onPress={handleCalculate} disabled={!results}>
            <Text style={styles.calculateButtonText}>Calculate</Text>
          </PressableRow>
          <PressableRow style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </PressableRow>
        </View>
      </View>

      {calculated && results && (
        <>
          <ResultsCardWithShare title="Drain Fall Results" shareData={shareData} styles={styles}>
            <ResultRow label="Minimum Grade" value={`${results.minGrade}%`} highlight styles={styles} />
            <ResultRow label="Total Fall" value={`${results.totalFall} mm`} highlight styles={styles} />
            <ResultRow label="Total Fall" value={`${results.totalFallM} m`} styles={styles} />
            <ResultRow label="Gradient Ratio" value={results.ratio} styles={styles} />
            <ResultRow label="Pipe Size" value={`DN${results.pipeSize}`} styles={styles} />
            <ResultRow label="Drain Type" value={results.drainType} last styles={styles} />
          </ResultsCardWithShare>
          <View style={styles.costEstimate}>
            <Feather name="dollar-sign" size={iconSizes.md} color={colors.mutedForeground} />
            <View style={{ flex: 1 }}>
              <Text style={styles.costLabel}>Estimated PVC pipe cost (DN{results.pipeSize})</Text>
              <Text style={styles.costValue}>
                ~${(parseFloat(runLength) * (pipeSize === '100' ? 12 : pipeSize === '150' ? 22 : pipeSize === '225' ? 45 : 8)).toFixed(0)} AUD
              </Text>
            </View>
          </View>
        </>
      )}
    </>
  );
}

function BalusterCalculator({ colors, styles, onResult }: { colors: any; styles: any; onResult: (preview: string) => void }) {
  const [totalSpan, setTotalSpan] = useState('');
  const [maxGap, setMaxGap] = useState('100');
  const [balusterWidth, setBalusterWidth] = useState('40');
  const [calculated, setCalculated] = useState(false);

  const results = useMemo(() => {
    const span = parseFloat(totalSpan);
    const gap = parseFloat(maxGap);
    const width = parseFloat(balusterWidth);
    if (!span || !gap || !width || span <= 0) return null;

    const numberOfGaps = Math.floor(span / (gap + width)) + 1;
    const numberOfBalusters = numberOfGaps - 1;
    const actualGap = (span - (numberOfBalusters * width)) / numberOfGaps;

    const estimatedCost = Math.max(0, numberOfBalusters) * 12;

    return {
      numberOfBalusters: Math.max(0, numberOfBalusters),
      numberOfGaps,
      actualGap: actualGap.toFixed(1),
      totalSpanUsed: span,
      estimatedCost: estimatedCost.toFixed(0),
    };
  }, [totalSpan, maxGap, balusterWidth]);

  const handleCalculate = () => {
    if (results) {
      setCalculated(true);
      onResult(`${results.numberOfBalusters} balusters, ${results.actualGap}mm gap`);
    }
  };

  const handleReset = () => {
    setTotalSpan('');
    setMaxGap('100');
    setBalusterWidth('40');
    setCalculated(false);
  };

  const shareData = results ? [
    { label: 'Number of Balusters', value: `${results.numberOfBalusters}` },
    { label: 'Number of Gaps', value: `${results.numberOfGaps}` },
    { label: 'Actual Gap', value: `${results.actualGap} mm` },
    { label: 'Total Span', value: `${results.totalSpanUsed} mm` },
  ] : [];

  return (
    <>
      <View style={styles.calcDetailCard}>
        <View style={styles.calcDetailHeader}>
          <View style={[styles.calcIconContainer, { backgroundColor: colors.warningDark + '20' }]}>
            <Feather name="maximize" size={iconSizes.xl} color={colors.warningDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.calcDetailTitle}>Baluster Spacing</Text>
            <Text style={styles.calcDetailSubtitle}>Calculate count and gap spacing for decks and rails</Text>
          </View>
        </View>

        <FormulaBox
          label="Formula"
          formula="Gaps = floor(Span / (MaxGap + Width)) + 1
Balusters = Gaps - 1
ActualGap = (Span - Balusters × Width) / Gaps"
          colors={colors}
          styles={styles}
        />

        <View style={[styles.infoBox, { backgroundColor: colors.primary + '20' }]}>
          <Feather name="info" size={iconSizes.md} color={colors.primary} style={{ marginTop: 2 }} />
          <Text style={[styles.infoText, { color: colors.primary }]}>
            Australian Building Code requires a maximum gap of 100mm between balusters to prevent children from passing through.
          </Text>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Total Span (mm)</Text>
          <TextInput
            style={styles.textInput}
            value={totalSpan}
            onChangeText={(v) => { setTotalSpan(v); setCalculated(false); }}
            placeholder="e.g., 3000"
            placeholderTextColor={colors.mutedForeground}
            keyboardType="numeric"
          />
          <Text style={styles.inputHint}>Inside edge to inside edge</Text>
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputRowItem}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Max Gap (mm)</Text>
              <TextInput
                style={styles.textInput}
                value={maxGap}
                onChangeText={(v) => { setMaxGap(v); setCalculated(false); }}
                placeholder="100"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
              />
              <Text style={styles.inputHint}>AU standard: 100mm</Text>
            </View>
          </View>
          <View style={styles.inputRowItem}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Baluster Width (mm)</Text>
              <TextInput
                style={styles.textInput}
                value={balusterWidth}
                onChangeText={(v) => { setBalusterWidth(v); setCalculated(false); }}
                placeholder="40"
                placeholderTextColor={colors.mutedForeground}
                keyboardType="numeric"
              />
              <Text style={styles.inputHint}>Width of each baluster</Text>
            </View>
          </View>
        </View>

        <View style={styles.buttonRow}>
          <PressableRow style={[styles.calculateButton, !results && styles.calculateButtonDisabled]} onPress={handleCalculate} disabled={!results} >
            <Text style={styles.calculateButtonText}>Calculate</Text>
          </PressableRow>
          <PressableRow style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </PressableRow>
        </View>
      </View>

      {calculated && results && (
        <>
          <ResultsCardWithShare title="Baluster Results" shareData={shareData} styles={styles}>
            <ResultRow label="Number of Balusters" value={`${results.numberOfBalusters}`} highlight styles={styles} />
            <ResultRow label="Number of Gaps" value={`${results.numberOfGaps}`} styles={styles} />
            <ResultRow label="Actual Gap" value={`${results.actualGap} mm`} styles={styles} />
            <ResultRow label="Total Span" value={`${results.totalSpanUsed} mm`} last styles={styles} />
          </ResultsCardWithShare>
          <View style={styles.costEstimate}>
            <Feather name="dollar-sign" size={iconSizes.md} color={colors.mutedForeground} />
            <View style={{ flex: 1 }}>
              <Text style={styles.costLabel}>Estimated baluster cost (~$12 each timber)</Text>
              <Text style={styles.costValue}>~${results.estimatedCost} AUD</Text>
            </View>
          </View>
        </>
      )}
    </>
  );
}

function ConcreteCalculator({ colors, styles, onResult }: { colors: any; styles: any; onResult: (preview: string) => void }) {
  const [shape, setShape] = useState<'rectangle' | 'circle'>('rectangle');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [diameter, setDiameter] = useState('');
  const [depth, setDepth] = useState('');
  const [includeWastage, setIncludeWastage] = useState(true);
  const [calculated, setCalculated] = useState(false);

  const results = useMemo(() => {
    const d = parseFloat(depth);
    if (!d || d <= 0) return null;

    let baseVolume: number;
    if (shape === 'rectangle') {
      const l = parseFloat(length);
      const w = parseFloat(width);
      if (!l || !w || l <= 0 || w <= 0) return null;
      baseVolume = l * w * d;
    } else {
      const dia = parseFloat(diameter);
      if (!dia || dia <= 0) return null;
      const r = dia / 2;
      baseVolume = Math.PI * r * r * d;
    }

    const wastageMultiplier = includeWastage ? 1.10 : 1.0;
    const totalVolume = baseVolume * wastageMultiplier;
    const bagsNeeded = Math.ceil(totalVolume / 0.01);
    const estimatedCost = totalVolume * 250;

    return {
      baseVolume: baseVolume.toFixed(3),
      wastageAmount: includeWastage ? (baseVolume * 0.10).toFixed(3) : '0.000',
      totalVolume: totalVolume.toFixed(3),
      bags20kg: bagsNeeded,
      estimatedCost: estimatedCost.toFixed(0),
    };
  }, [shape, length, width, diameter, depth, includeWastage]);

  const handleCalculate = () => {
    if (results) {
      setCalculated(true);
      onResult(`${results.totalVolume}m³, ${results.bags20kg} bags`);
    }
  };

  const handleReset = () => {
    setLength(''); setWidth(''); setDiameter(''); setDepth('');
    setIncludeWastage(true); setCalculated(false);
  };

  const shareData = results ? [
    { label: 'Total Volume', value: `${results.totalVolume} m³` },
    { label: 'Base Volume', value: `${results.baseVolume} m³` },
    { label: 'Wastage (10%)', value: `${results.wastageAmount} m³` },
    { label: '20kg Bags Needed', value: `${results.bags20kg} bags` },
  ] : [];

  return (
    <>
      <View style={styles.calcDetailCard}>
        <View style={styles.calcDetailHeader}>
          <View style={[styles.calcIconContainer, { backgroundColor: colors.warningDark + '20' }]}>
            <Feather name="square" size={iconSizes.xl} color={colors.warningDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.calcDetailTitle}>Concrete Volume</Text>
            <Text style={styles.calcDetailSubtitle}>Calculate cubic meters and premix bags</Text>
          </View>
        </View>

        <FormulaBox
          label="Formula"
          formula={shape === 'rectangle' ? "V = Length × Width × Depth" : "V = π × (D/2)² × Depth"}
          colors={colors}
          styles={styles}
        />

        <View style={[styles.infoBox, { backgroundColor: colors.warningDark + '20' }]}>
          <Feather name="info" size={iconSizes.md} color={colors.warningDark} style={{ marginTop: 2 }} />
          <Text style={[styles.infoText, { color: colors.warningDark }]}>
            1 x 20kg bag of premix concrete yields approximately 0.01m³ (10 litres) of mixed concrete.
          </Text>
        </View>

        <Text style={styles.inputLabel}>Shape</Text>
        <View style={styles.segmentRow}>
          <PressableRow style={[styles.segmentButton, shape === 'rectangle' && styles.segmentButtonActive]} onPress={() => { setShape('rectangle'); setCalculated(false); }} >
            <Text style={[styles.segmentButtonText, shape === 'rectangle' && styles.segmentButtonTextActive]}>Rectangle / Square</Text>
          </PressableRow>
          <PressableRow style={[styles.segmentButton, shape === 'circle' && styles.segmentButtonActive]} onPress={() => { setShape('circle'); setCalculated(false); }} >
            <Text style={[styles.segmentButtonText, shape === 'circle' && styles.segmentButtonTextActive]}>Circle</Text>
          </PressableRow>
        </View>

        {shape === 'rectangle' ? (
          <View style={styles.inputRow}>
            <View style={styles.inputRowItem}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Length (m)</Text>
                <TextInput style={styles.textInput} value={length} onChangeText={(v) => { setLength(v); setCalculated(false); }} placeholder="e.g., 3.5" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
              </View>
            </View>
            <View style={styles.inputRowItem}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Width (m)</Text>
                <TextInput style={styles.textInput} value={width} onChangeText={(v) => { setWidth(v); setCalculated(false); }} placeholder="e.g., 2.5" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Diameter (m)</Text>
            <TextInput style={styles.textInput} value={diameter} onChangeText={(v) => { setDiameter(v); setCalculated(false); }} placeholder="e.g., 1.2" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
          </View>
        )}

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Depth (m)</Text>
          <TextInput style={styles.textInput} value={depth} onChangeText={(v) => { setDepth(v); setCalculated(false); }} placeholder="e.g., 0.1" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
        </View>

        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>Include 10% Wastage</Text>
            <Text style={styles.switchHint}>Recommended for site conditions</Text>
          </View>
          <Switch
            value={includeWastage}
            onValueChange={(v) => { setIncludeWastage(v); setCalculated(false); }}
            trackColor={{ false: colors.muted, true: colors.primary }}
            thumbColor={colors.card}
          />
        </View>

        <View style={styles.buttonRow}>
          <PressableRow style={[styles.calculateButton, !results && styles.calculateButtonDisabled]} onPress={handleCalculate} disabled={!results}>
            <Text style={styles.calculateButtonText}>Calculate</Text>
          </PressableRow>
          <PressableRow style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </PressableRow>
        </View>
      </View>

      {calculated && results && (
        <>
          <ResultsCardWithShare title="Concrete Volume Results" shareData={shareData} styles={styles}>
            <ResultRow label="Total Volume" value={`${results.totalVolume} m³`} highlight styles={styles} />
            <ResultRow label="Base Volume" value={`${results.baseVolume} m³`} styles={styles} />
            <ResultRow label="Wastage (10%)" value={`${results.wastageAmount} m³`} styles={styles} />
            <ResultRow label="20kg Bags Needed" value={`${results.bags20kg} bags`} highlight last styles={styles} />
          </ResultsCardWithShare>
          <View style={styles.costEstimate}>
            <Feather name="dollar-sign" size={iconSizes.md} color={colors.mutedForeground} />
            <View style={{ flex: 1 }}>
              <Text style={styles.costLabel}>Estimated ready-mix cost (~$250/m³)</Text>
              <Text style={styles.costValue}>~${results.estimatedCost} AUD</Text>
            </View>
          </View>
        </>
      )}
    </>
  );
}

const tileSizes = [
  { value: '300x300', label: '300x300mm', area: 0.09 },
  { value: '400x400', label: '400x400mm', area: 0.16 },
  { value: '450x450', label: '450x450mm', area: 0.2025 },
  { value: '600x600', label: '600x600mm', area: 0.36 },
  { value: '600x300', label: '600x300mm', area: 0.18 },
  { value: '800x800', label: '800x800mm', area: 0.64 },
];

function TileCalculator({ colors, styles, onResult }: { colors: any; styles: any; onResult: (preview: string) => void }) {
  const [roomLength, setRoomLength] = useState('');
  const [roomWidth, setRoomWidth] = useState('');
  const [tileSize, setTileSize] = useState('600x600');
  const [tilesPerBox, setTilesPerBox] = useState('4');
  const [wastagePercent, setWastagePercent] = useState(10);
  const [calculated, setCalculated] = useState(false);

  const selectedTile = tileSizes.find(s => s.value === tileSize);

  const results = useMemo(() => {
    const length = parseFloat(roomLength);
    const width = parseFloat(roomWidth);
    const perBox = parseInt(tilesPerBox);
    if (!length || !width || length <= 0 || width <= 0 || !perBox || perBox <= 0) return null;

    const tileArea = selectedTile?.area || 0.36;
    const roomArea = length * width;
    const baseTiles = Math.ceil(roomArea / tileArea);
    const wastageMultiplier = 1 + (wastagePercent / 100);
    const totalTiles = Math.ceil(baseTiles * wastageMultiplier);
    const boxesNeeded = Math.ceil(totalTiles / perBox);

    const estimatedTileCost = totalTiles * 8;
    const estimatedAdhesiveBags = Math.ceil(roomArea / 5);
    const estimatedGroutKg = Math.ceil(roomArea * 0.5);

    return {
      roomArea: roomArea.toFixed(2),
      baseTiles,
      totalTiles,
      boxesNeeded,
      wastageAmount: totalTiles - baseTiles,
      estimatedTileCost: estimatedTileCost.toFixed(0),
      adhesiveBags: estimatedAdhesiveBags,
      groutKg: estimatedGroutKg,
    };
  }, [roomLength, roomWidth, tileSize, tilesPerBox, wastagePercent, selectedTile]);

  const handleCalculate = () => {
    if (results) {
      setCalculated(true);
      onResult(`${results.totalTiles} tiles, ${results.boxesNeeded} boxes`);
    }
  };

  const handleReset = () => {
    setRoomLength(''); setRoomWidth(''); setTileSize('600x600');
    setTilesPerBox('4'); setWastagePercent(10); setCalculated(false);
  };

  const shareData = results ? [
    { label: 'Total Tiles', value: `${results.totalTiles} tiles` },
    { label: 'Boxes Needed', value: `${results.boxesNeeded} boxes` },
    { label: 'Room Area', value: `${results.roomArea} m²` },
    { label: 'Wastage Tiles', value: `${results.wastageAmount} tiles (${wastagePercent}%)` },
  ] : [];

  return (
    <>
      <View style={styles.calcDetailCard}>
        <View style={styles.calcDetailHeader}>
          <View style={[styles.calcIconContainer, { backgroundColor: '#05966920' }]}>
            <Feather name="grid" size={iconSizes.xl} color="#059669" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.calcDetailTitle}>Tile Quantity</Text>
            <Text style={styles.calcDetailSubtitle}>Calculate tile count with wastage</Text>
          </View>
        </View>

        <FormulaBox
          label="Formula"
          formula="Tiles = ceil(Area / TileArea) × (1 + Wastage%)"
          colors={colors}
          styles={styles}
        />

        <View style={[styles.infoBox, { backgroundColor: '#05966920' }]}>
          <Feather name="info" size={iconSizes.md} color="#059669" style={{ marginTop: 2 }} />
          <Text style={[styles.infoText, { color: '#059669' }]}>
            Add 5-15% wastage for cuts, breakages, and pattern matching. Use higher wastage for diagonal patterns.
          </Text>
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputRowItem}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Room Length (m)</Text>
              <TextInput style={styles.textInput} value={roomLength} onChangeText={(v) => { setRoomLength(v); setCalculated(false); }} placeholder="e.g., 5.5" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
            </View>
          </View>
          <View style={styles.inputRowItem}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Room Width (m)</Text>
              <TextInput style={styles.textInput} value={roomWidth} onChangeText={(v) => { setRoomWidth(v); setCalculated(false); }} placeholder="e.g., 4.0" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
            </View>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Tile Size</Text>
          <View style={styles.tileSizeGrid}>
            {tileSizes.map(size => (
              <PressableRow key={size.value} style={[styles.tileSizeButton, tileSize === size.value && styles.tileSizeButtonActive]} onPress={() => { setTileSize(size.value); setCalculated(false); }} >
                <Text style={[styles.tileSizeButtonText, tileSize === size.value && styles.tileSizeButtonTextActive]}>{size.label}</Text>
              </PressableRow>
            ))}
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Tiles Per Box</Text>
          <TextInput style={styles.textInput} value={tilesPerBox} onChangeText={(v) => { setTilesPerBox(v); setCalculated(false); }} placeholder="4" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
        </View>

        <View style={styles.wastageRow}>
          <Text style={styles.wastageLabel}>Wastage Allowance</Text>
          <Text style={styles.wastageValue}>{wastagePercent}%</Text>
        </View>
        <View style={styles.wastageButtons}>
          {[5, 7, 10, 12, 15].map(pct => (
            <PressableRow key={pct} style={[styles.wastageButton, wastagePercent === pct && styles.wastageButtonActive]} onPress={() => { setWastagePercent(pct); setCalculated(false); }} >
              <Text style={[styles.wastageButtonText, wastagePercent === pct && styles.wastageButtonTextActive]}>{pct}%</Text>
            </PressableRow>
          ))}
        </View>

        <View style={styles.buttonRow}>
          <PressableRow style={[styles.calculateButton, !results && styles.calculateButtonDisabled]} onPress={handleCalculate} disabled={!results}>
            <Text style={styles.calculateButtonText}>Calculate</Text>
          </PressableRow>
          <PressableRow style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </PressableRow>
        </View>
      </View>

      {calculated && results && (
        <>
          <ResultsCardWithShare title="Tile Quantity Results" shareData={shareData} styles={styles}>
            <ResultRow label="Total Tiles" value={`${results.totalTiles} tiles`} highlight styles={styles} />
            <ResultRow label="Boxes Needed" value={`${results.boxesNeeded} boxes`} highlight styles={styles} />
            <ResultRow label="Room Area" value={`${results.roomArea} m²`} styles={styles} />
            <ResultRow label="Base Tiles" value={`${results.baseTiles} tiles`} styles={styles} />
            <ResultRow label="Wastage Tiles" value={`${results.wastageAmount} tiles (${wastagePercent}%)`} last styles={styles} />
          </ResultsCardWithShare>
          <View style={styles.costEstimate}>
            <Feather name="dollar-sign" size={iconSizes.md} color={colors.mutedForeground} />
            <View style={{ flex: 1 }}>
              <Text style={styles.costLabel}>Estimated tile cost (~$8/tile mid-range)</Text>
              <Text style={styles.costValue}>~${results.estimatedTileCost} AUD</Text>
            </View>
          </View>
          <View style={styles.costEstimate}>
            <Feather name="package" size={iconSizes.md} color={colors.mutedForeground} />
            <View style={{ flex: 1 }}>
              <Text style={styles.costLabel}>Materials estimate</Text>
              <Text style={styles.costValue}>{results.adhesiveBags} bags adhesive + {results.groutKg}kg grout</Text>
            </View>
          </View>
        </>
      )}
    </>
  );
}

function PaintCalculator({ colors, styles, onResult }: { colors: any; styles: any; onResult: (preview: string) => void }) {
  const [wallHeight, setWallHeight] = useState('');
  const [perimeter, setPerimeter] = useState('');
  const [doorCount, setDoorCount] = useState('0');
  const [windowCount, setWindowCount] = useState('0');
  const [twoCoats, setTwoCoats] = useState(true);
  const [calculated, setCalculated] = useState(false);

  const COVERAGE_PER_LITRE = 12;
  const DOOR_AREA = 1.9;
  const WINDOW_AREA = 1.5;

  const results = useMemo(() => {
    const height = parseFloat(wallHeight);
    const perim = parseFloat(perimeter);
    const doors = parseInt(doorCount) || 0;
    const windows = parseInt(windowCount) || 0;
    if (!height || !perim || height <= 0 || perim <= 0) return null;

    const grossArea = height * perim;
    const doorExclusion = doors * DOOR_AREA;
    const windowExclusion = windows * WINDOW_AREA;
    const netArea = Math.max(0, grossArea - doorExclusion - windowExclusion);
    const coatMultiplier = twoCoats ? 2 : 1;
    const paintableArea = netArea * coatMultiplier;
    const litresNeeded = Math.ceil(paintableArea / COVERAGE_PER_LITRE);
    const estimatedCost = litresNeeded * 15;
    const cans4L = Math.ceil(litresNeeded / 4);
    const cans10L = Math.ceil(litresNeeded / 10);

    return {
      grossArea: grossArea.toFixed(2),
      doorExclusion: doorExclusion.toFixed(2),
      windowExclusion: windowExclusion.toFixed(2),
      netArea: netArea.toFixed(2),
      paintableArea: paintableArea.toFixed(2),
      litresNeeded,
      cans4L,
      cans10L,
      estimatedCost: estimatedCost.toFixed(0),
    };
  }, [wallHeight, perimeter, doorCount, windowCount, twoCoats]);

  const handleCalculate = () => {
    if (results) {
      setCalculated(true);
      onResult(`${results.litresNeeded}L paint needed`);
    }
  };

  const handleReset = () => {
    setWallHeight(''); setPerimeter(''); setDoorCount('0');
    setWindowCount('0'); setTwoCoats(true); setCalculated(false);
  };

  const shareData = results ? [
    { label: 'Litres Needed', value: `${results.litresNeeded} L` },
    { label: 'Net Wall Area', value: `${results.netArea} m²` },
    { label: 'Paintable Area', value: `${results.paintableArea} m² (${twoCoats ? '2 coats' : '1 coat'})` },
    { label: 'Gross Wall Area', value: `${results.grossArea} m²` },
  ] : [];

  return (
    <>
      <View style={styles.calcDetailCard}>
        <View style={styles.calcDetailHeader}>
          <View style={[styles.calcIconContainer, { backgroundColor: '#7c3aed20' }]}>
            <Feather name="droplet" size={iconSizes.xl} color="#7c3aed" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.calcDetailTitle}>Paint Coverage</Text>
            <Text style={styles.calcDetailSubtitle}>Calculate paint needed for walls</Text>
          </View>
        </View>

        <FormulaBox
          label="Formula"
          formula="Litres = (NetArea × Coats) / 12 m²/L"
          colors={colors}
          styles={styles}
        />

        <View style={[styles.infoBox, { backgroundColor: '#7c3aed20' }]}>
          <Feather name="info" size={iconSizes.md} color="#7c3aed" style={{ marginTop: 2 }} />
          <Text style={[styles.infoText, { color: '#7c3aed' }]}>
            Assuming standard coverage of 12m² per litre. Standard door = 1.9m², window = 1.5m². Two coats recommended.
          </Text>
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputRowItem}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Wall Height (m)</Text>
              <TextInput style={styles.textInput} value={wallHeight} onChangeText={(v) => { setWallHeight(v); setCalculated(false); }} placeholder="e.g., 2.4" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
              <Text style={styles.inputHint}>Standard: 2.4m</Text>
            </View>
          </View>
          <View style={styles.inputRowItem}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Room Perimeter (m)</Text>
              <TextInput style={styles.textInput} value={perimeter} onChangeText={(v) => { setPerimeter(v); setCalculated(false); }} placeholder="e.g., 20" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
              <Text style={styles.inputHint}>Total wall length</Text>
            </View>
          </View>
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputRowItem}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Number of Doors</Text>
              <TextInput style={styles.textInput} value={doorCount} onChangeText={(v) => { setDoorCount(v); setCalculated(false); }} placeholder="0" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
            </View>
          </View>
          <View style={styles.inputRowItem}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Number of Windows</Text>
              <TextInput style={styles.textInput} value={windowCount} onChangeText={(v) => { setWindowCount(v); setCalculated(false); }} placeholder="0" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
            </View>
          </View>
        </View>

        <View style={styles.switchRow}>
          <View>
            <Text style={styles.switchLabel}>Two Coats</Text>
            <Text style={styles.switchHint}>Recommended for professional finish</Text>
          </View>
          <Switch
            value={twoCoats}
            onValueChange={(v) => { setTwoCoats(v); setCalculated(false); }}
            trackColor={{ false: colors.muted, true: colors.primary }}
            thumbColor={colors.card}
          />
        </View>

        <View style={styles.buttonRow}>
          <PressableRow style={[styles.calculateButton, !results && styles.calculateButtonDisabled]} onPress={handleCalculate} disabled={!results}>
            <Text style={styles.calculateButtonText}>Calculate</Text>
          </PressableRow>
          <PressableRow style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </PressableRow>
        </View>
      </View>

      {calculated && results && (
        <>
          <ResultsCardWithShare title="Paint Coverage Results" shareData={shareData} styles={styles}>
            <ResultRow label="Litres Needed" value={`${results.litresNeeded} L`} highlight styles={styles} />
            <ResultRow label="Net Wall Area" value={`${results.netArea} m²`} styles={styles} />
            <ResultRow label="Paintable Area" value={`${results.paintableArea} m² (${twoCoats ? '2 coats' : '1 coat'})`} styles={styles} />
            <ResultRow label="Gross Wall Area" value={`${results.grossArea} m²`} styles={styles} />
            <ResultRow label="Door Exclusion" value={`${results.doorExclusion} m²`} styles={styles} />
            <ResultRow label="Window Exclusion" value={`${results.windowExclusion} m²`} last styles={styles} />
          </ResultsCardWithShare>
          <View style={styles.costEstimate}>
            <Feather name="package" size={iconSizes.md} color={colors.mutedForeground} />
            <View style={{ flex: 1 }}>
              <Text style={styles.costLabel}>Paint cans needed</Text>
              <Text style={styles.costValue}>{results.cans4L} x 4L cans or {results.cans10L} x 10L cans</Text>
            </View>
          </View>
          <View style={styles.costEstimate}>
            <Feather name="dollar-sign" size={iconSizes.md} color={colors.mutedForeground} />
            <View style={{ flex: 1 }}>
              <Text style={styles.costLabel}>Estimated paint cost (~$15/L mid-range)</Text>
              <Text style={styles.costValue}>~${results.estimatedCost} AUD</Text>
            </View>
          </View>
        </>
      )}
    </>
  );
}

function RoofCalculator({ colors, styles, onResult }: { colors: any; styles: any; onResult: (preview: string) => void }) {
  const [run, setRun] = useState('');
  const [rise, setRise] = useState('');
  const [roofLength, setRoofLength] = useState('');
  const [calculated, setCalculated] = useState(false);

  const results = useMemo(() => {
    const runVal = parseFloat(run);
    const riseVal = parseFloat(rise);
    if (!runVal || !riseVal || runVal <= 0 || riseVal <= 0) return null;

    const pitchAngleRad = Math.atan(riseVal / runVal);
    const pitchAngleDeg = (pitchAngleRad * 180) / Math.PI;
    const pitchRatio = (riseVal / runVal) * 12;
    const rakerLength = Math.sqrt(runVal * runVal + riseVal * riseVal);

    let roofArea: number | null = null;
    let roofSheets: number | null = null;
    const roofLengthVal = parseFloat(roofLength);
    if (roofLengthVal && roofLengthVal > 0) {
      roofArea = rakerLength * roofLengthVal * 2;
      roofSheets = Math.ceil(roofArea / 4.8);
    }

    return {
      pitchAngle: pitchAngleDeg.toFixed(1),
      pitchRatio: pitchRatio.toFixed(1),
      rakerLength: rakerLength.toFixed(3),
      roofArea: roofArea?.toFixed(2),
      roofSheets,
    };
  }, [run, rise, roofLength]);

  const getPitchDescription = (angle: number) => {
    if (angle < 10) return 'Low pitch (flat roof)';
    if (angle < 20) return 'Low-medium pitch';
    if (angle < 35) return 'Standard pitch';
    if (angle < 45) return 'Steep pitch';
    return 'Very steep pitch';
  };

  const handleCalculate = () => {
    if (results) {
      setCalculated(true);
      onResult(`${results.pitchAngle}° pitch, ${results.pitchRatio}:12`);
    }
  };

  const handleReset = () => {
    setRun(''); setRise(''); setRoofLength(''); setCalculated(false);
  };

  const shareData = results ? [
    { label: 'Pitch Angle', value: `${results.pitchAngle}°` },
    { label: 'Pitch Ratio', value: `${results.pitchRatio}:12` },
    { label: 'Classification', value: getPitchDescription(parseFloat(results.pitchAngle)) },
    { label: 'Raker Length', value: `${results.rakerLength} m` },
    ...(results.roofArea ? [{ label: 'Total Roof Area', value: `${results.roofArea} m²` }] : []),
  ] : [];

  return (
    <>
      <View style={styles.calcDetailCard}>
        <View style={styles.calcDetailHeader}>
          <View style={[styles.calcIconContainer, { backgroundColor: colors.warningDark + '20' }]}>
            <Feather name="home" size={iconSizes.xl} color={colors.warningDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.calcDetailTitle}>Roof Pitch</Text>
            <Text style={styles.calcDetailSubtitle}>Calculate pitch angle, ratio, and roof area</Text>
          </View>
        </View>

        <FormulaBox
          label="Formula"
          formula="Angle = atan(Rise / Run)
Raker = sqrt(Rise² + Run²)"
          colors={colors}
          styles={styles}
        />

        <View style={[styles.infoBox, { backgroundColor: colors.warningDark + '20' }]}>
          <Feather name="info" size={iconSizes.md} color={colors.warningDark} style={{ marginTop: 2 }} />
          <Text style={[styles.infoText, { color: colors.warningDark }]}>
            A 4:12 pitch means the roof rises 4 units for every 12 units of horizontal run. Common Australian roof pitches range from 15° to 25°.
          </Text>
        </View>

        <View style={styles.inputRow}>
          <View style={styles.inputRowItem}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Run - Horizontal (m)</Text>
              <TextInput style={styles.textInput} value={run} onChangeText={(v) => { setRun(v); setCalculated(false); }} placeholder="e.g., 4.5" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
              <Text style={styles.inputHint}>Half building width for gable</Text>
            </View>
          </View>
          <View style={styles.inputRowItem}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Rise - Vertical (m)</Text>
              <TextInput style={styles.textInput} value={rise} onChangeText={(v) => { setRise(v); setCalculated(false); }} placeholder="e.g., 1.8" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
              <Text style={styles.inputHint}>Wall plate to ridge</Text>
            </View>
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.inputLabel}>Roof Length (m) - Optional</Text>
          <TextInput style={styles.textInput} value={roofLength} onChangeText={(v) => { setRoofLength(v); setCalculated(false); }} placeholder="e.g., 12" placeholderTextColor={colors.mutedForeground} keyboardType="numeric" />
          <Text style={styles.inputHint}>Enter to calculate total roof area (both sides)</Text>
        </View>

        <View style={styles.buttonRow}>
          <PressableRow style={[styles.calculateButton, !results && styles.calculateButtonDisabled]} onPress={handleCalculate} disabled={!results}>
            <Text style={styles.calculateButtonText}>Calculate</Text>
          </PressableRow>
          <PressableRow style={styles.resetButton} onPress={handleReset}>
            <Text style={styles.resetButtonText}>Reset</Text>
          </PressableRow>
        </View>
      </View>

      {calculated && results && (
        <>
          <ResultsCardWithShare title="Roof Pitch Results" shareData={shareData} styles={styles}>
            <ResultRow label="Pitch Angle" value={`${results.pitchAngle}°`} highlight styles={styles} />
            <ResultRow label="Pitch Ratio" value={`${results.pitchRatio}:12`} highlight styles={styles} />
            <ResultRow label="Classification" value={getPitchDescription(parseFloat(results.pitchAngle))} styles={styles} />
            <ResultRow label="Raker Length" value={`${results.rakerLength} m`} styles={styles} />
            {results.roofArea && (
              <ResultRow label="Total Roof Area" value={`${results.roofArea} m²`} highlight last styles={styles} />
            )}
          </ResultsCardWithShare>
          {results.roofSheets && (
            <View style={styles.costEstimate}>
              <Feather name="layers" size={iconSizes.md} color={colors.mutedForeground} />
              <View style={{ flex: 1 }}>
                <Text style={styles.costLabel}>Estimated roofing sheets (~4.8m² coverage each)</Text>
                <Text style={styles.costValue}>{results.roofSheets} sheets needed</Text>
              </View>
            </View>
          )}
        </>
      )}
    </>
  );
}

function ResultRow({ label, value, highlight, last, styles }: { label: string; value: string; highlight?: boolean; last?: boolean; styles: any }) {
  return (
    <View style={[styles.resultRow, last && styles.resultRowLast]}>
      <Text style={styles.resultLabel}>{label}</Text>
      {highlight ? (
        <View style={styles.resultHighlight}>
          <Text style={styles.resultHighlightText}>{value}</Text>
        </View>
      ) : (
        <Text style={styles.resultValue}>{value}</Text>
      )}
    </View>
  );
}

export default function CalculatorsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  const [activeCalc, setActiveCalc] = useState<CalculatorId | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const { businessSettings } = useAuthStore();

  const tradeType = (businessSettings?.tradeType || '').toLowerCase();

  const { recommended, other } = useMemo(() => {
    if (!tradeType) return { recommended: [], other: calculators };

    const rec: CalculatorInfo[] = [];
    const oth: CalculatorInfo[] = [];

    calculators.forEach(calc => {
      if (calc.trades.some(t => tradeType.includes(t))) {
        rec.push(calc);
      } else {
        oth.push(calc);
      }
    });

    return { recommended: rec, other: oth };
  }, [tradeType]);

  const handleResult = useCallback((calcId: CalculatorId, preview: string) => {
    setPreviews(prev => ({ ...prev, [calcId]: preview }));
  }, []);

  const renderCalculator = () => {
    const props = { colors, styles, onResult: (preview: string) => handleResult(activeCalc!, preview) };
    switch (activeCalc) {
      case 'pipe_sizing': return <PipeSizingCalculator {...props} />;
      case 'water_flow': return <WaterFlowCalculator {...props} />;
      case 'drain_fall': return <DrainFallCalculator {...props} />;
      case 'baluster': return <BalusterCalculator {...props} />;
      case 'concrete': return <ConcreteCalculator {...props} />;
      case 'tile': return <TileCalculator {...props} />;
      case 'paint': return <PaintCalculator {...props} />;
      case 'roof': return <RoofCalculator {...props} />;
      default: return null;
    }
  };

  const renderCalcCard = (calc: CalculatorInfo, isRecommended?: boolean) => (
    <PressableRow key={calc.id} style={styles.calcCard} onPress={() => setActiveCalc(calc.id)} >
      <View style={[styles.calcIconContainer, { backgroundColor: calc.categoryColor + '20' }]}>
        <Feather name={calc.icon} size={iconSizes.xl} color={calc.categoryColor} />
      </View>
      <View style={styles.calcContent}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: spacing.xs }}>
          <Text style={styles.calcName}>{calc.name}</Text>
          {isRecommended && (
            <View style={[styles.recommendedBadge, { backgroundColor: colors.primaryLight }]}>
              <Text style={[styles.recommendedBadgeText, { color: colors.primary }]}>FOR YOU</Text>
            </View>
          )}
        </View>
        <Text style={styles.calcDescription} numberOfLines={2}>{calc.description}</Text>
        {previews[calc.id] && (
          <Text style={styles.calcPreview} numberOfLines={1}>Last: {previews[calc.id]}</Text>
        )}
        <View style={[styles.categoryBadge, { backgroundColor: calc.categoryColor + '15' }]}>
          <Text style={[styles.categoryBadgeText, { color: calc.categoryColor }]}>{calc.category}</Text>
        </View>
      </View>
      <Feather name="chevron-right" size={iconSizes.lg} color={colors.mutedForeground} style={styles.chevron} />
    </PressableRow>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.contentContainer}
            keyboardShouldPersistTaps="handled"
          >
            {activeCalc ? (
              <>
                <PressableRow style={styles.backButton} onPress={() => setActiveCalc(null)}>
                  <Feather name="arrow-left" size={iconSizes.xl} color={colors.primary} />
                  <Text style={styles.backButtonText}>Back to Calculators</Text>
                </PressableRow>
                {renderCalculator()}
              </>
            ) : (
              <>
                <View style={styles.header}>
                  <View style={styles.headerIconContainer}>
                    <Feather name="tool" size={iconSizes.xl} color={colors.primary} />
                  </View>
                  <View>
                    <Text style={styles.pageTitle}>Trade Calculators</Text>
                    <Text style={styles.pageSubtitle}>Built-in calculations for your trade</Text>
                  </View>
                </View>

                {recommended.length > 0 && (
                  <>
                    <Text style={styles.sectionLabel}>RECOMMENDED FOR YOUR TRADE</Text>
                    {recommended.map(calc => renderCalcCard(calc, true))}
                    <Text style={[styles.sectionLabel, { marginTop: spacing.lg }]}>ALL CALCULATORS</Text>
                    {other.map(calc => renderCalcCard(calc))}
                  </>
                )}

                {recommended.length === 0 && (
                  calculators.map(calc => renderCalcCard(calc))
                )}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </View>
    </>
  );
}
