import { useMemo } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { useTheme, ThemeColors, colorWithOpacity } from '../../src/lib/theme';
import { spacing, radius, shadows, iconSizes } from '../../src/lib/design-tokens';

type HubItem = {
  title: string;
  subtitle: string;
  icon: keyof typeof Feather.glyphMap;
  color: string;
  path: string;
};

type HubSection = {
  heading: string;
  items: HubItem[];
};

const buildSections = (colors: ThemeColors): HubSection[] => [
  {
    heading: 'On the Job',
    items: [
      {
        title: 'Job Cards & Forms',
        subtitle: 'Checklists and forms your team fills in on site',
        icon: 'clipboard',
        color: colors.primary,
        path: '/more/form-builder',
      },
    ],
  },
  {
    heading: 'Documents',
    items: [
      {
        title: 'Quote & Invoice Styles',
        subtitle: 'Branding, layout and presets for your PDFs',
        icon: 'file-text',
        color: colors.info,
        path: '/more/templates',
      },
    ],
  },
  {
    heading: 'Messaging',
    items: [
      {
        title: 'Email & SMS Templates',
        subtitle: 'Reusable messages to send clients',
        icon: 'message-square',
        color: colors.success,
        path: '/more/business-templates',
      },
    ],
  },
  {
    heading: 'Safety',
    items: [
      {
        title: 'Safety & SWMS',
        subtitle: 'SWMS, incidents and WHS compliance',
        icon: 'shield',
        color: colors.warning,
        path: '/more/whs-hub',
      },
    ],
  },
];

export default function TemplatesHubScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const sections = useMemo(() => buildSections(colors), [colors]);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'Templates' }} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: bottomNavHeight + spacing.xl }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroSection}>
          <Text style={styles.pageTitle}>Templates</Text>
          <Text style={styles.pageSubtitle}>
            Set up the job cards, documents and messages your business reuses every day
          </Text>
        </View>

        {sections.map((section) => (
          <View key={section.heading} style={styles.section}>
            <Text style={styles.sectionHeading}>{section.heading}</Text>
            {section.items.map((item) => (
              <PressableRow
                key={item.path}
                style={styles.card}
                onPress={() => router.push(item.path as any)}
              >
                <View style={[styles.iconWrap, { backgroundColor: colorWithOpacity(item.color, 0.12) }]}>
                  <Feather name={item.icon} size={iconSizes.lg} color={item.color} />
                </View>
                <View style={styles.cardText}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
                </View>
                <Feather name="chevron-right" size={iconSizes.md} color={colors.mutedForeground} />
              </PressableRow>
            ))}
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    heroSection: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
    pageTitle: { fontSize: 28, fontWeight: '800', color: colors.foreground, letterSpacing: -0.5 },
    pageSubtitle: { fontSize: 14, color: colors.mutedForeground, marginTop: spacing.xs, lineHeight: 20 },
    section: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
    sectionHeading: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.mutedForeground,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: spacing.sm,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: spacing.lg,
      marginBottom: spacing.sm,
      ...shadows.sm,
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: radius.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    cardText: { flex: 1, minWidth: 0 },
    cardTitle: { fontSize: 16, fontWeight: '700', color: colors.foreground },
    cardSubtitle: { fontSize: 13, color: colors.mutedForeground, marginTop: 2, lineHeight: 18 },
  });
