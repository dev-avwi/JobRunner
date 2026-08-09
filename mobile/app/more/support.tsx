import { useState, useMemo, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Animated,
  Linking,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, iconSizes, fontWeights } from '../../src/lib/design-tokens';
import AppTour from '../../src/components/AppTour';
import * as Clipboard from 'expo-clipboard';
import * as Device from 'expo-device';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { useOfflineStore } from '../../src/lib/offline-storage';
import { useAuthStore } from '../../src/lib/store';
import api from '../../src/lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FAQItem {
  question: string;
  answer: string;
}

interface FAQCategory {
  id: string;
  title: string;
  icon: keyof typeof Feather.glyphMap;
  items: FAQItem[];
}

const FAQ_CATEGORIES: FAQCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: 'play-circle',
    items: [
      {
        question: 'How do I create my first job?',
        answer: 'Go to the Jobs tab and tap the + button. Fill in the job details including client, address, and description. You can also add photos and notes as you work.',
      },
      {
        question: 'How do I add my first client?',
        answer: 'Navigate to Profile > Clients and tap "Add Client". Enter their name, contact details, and address. Clients are automatically created when you add them to a new job too.',
      },
      {
        question: 'How do I set up my business details?',
        answer: 'Go to Profile > Business Settings to add your business name, ABN, contact details, and logo. This information appears on your quotes and invoices.',
      },
      {
        question: 'Can I customise my branding?',
        answer: 'Yes! Go to Profile > Branding to set your primary colour, upload your logo, and customise how your documents look to clients.',
      },
    ],
  },
  {
    id: 'jobs-scheduling',
    title: 'Jobs & Scheduling',
    icon: 'briefcase',
    items: [
      {
        question: 'What do the job statuses mean?',
        answer: 'Jobs flow through stages: Pending (new), Scheduled (date set), In Progress (started), Done (completed), and Invoiced (payment sent). You can update status with a tap.',
      },
      {
        question: 'How do I add photos to a job?',
        answer: 'Open any job and tap the camera icon or "Add Photos". You can take new photos or select from your gallery. Photos are organised as before/after for documentation.',
      },
      {
        question: 'How do I schedule a job?',
        answer: 'Open a job and tap "Schedule" to set a date and time. You can also drag jobs on the calendar view or use the dispatch board for team scheduling.',
      },
      {
        question: 'How do I mark a job as complete?',
        answer: 'Open the job and tap "Mark Complete" or swipe to change status. You can add completion notes, final photos, and get the client signature if needed.',
      },
    ],
  },
  {
    id: 'quotes',
    title: 'Quotes',
    icon: 'file-text',
    items: [
      {
        question: 'How do I create a quote?',
        answer: 'Go to Profile > Quotes and tap + to create a new quote. Select a client, add line items with descriptions and prices, then preview before sending.',
      },
      {
        question: 'How do I send a quote to a client?',
        answer: 'After creating a quote, tap "Send" to email it directly to your client. They\'ll receive a professional PDF with your branding.',
      },
      {
        question: 'Can I request a deposit on quotes?',
        answer: 'Yes! When creating a quote, you can set a deposit percentage or fixed amount. Clients will see this clearly when they view the quote.',
      },
      {
        question: 'How do I convert a quote to an invoice?',
        answer: 'Once a quote is accepted, open it and tap "Convert to Invoice". All the details will be copied over, ready for you to send.',
      },
    ],
  },
  {
    id: 'invoices-payments',
    title: 'Invoices & Payments',
    icon: 'dollar-sign',
    items: [
      {
        question: 'How do I create an invoice?',
        answer: 'Go to Profile > Invoices and tap + to create one, or convert an accepted quote. Add your line items, payment terms, and send to the client.',
      },
      {
        question: 'How do I send an invoice?',
        answer: 'After creating an invoice, tap "Send" to email it to your client. They\'ll receive a professional PDF with payment instructions.',
      },
      {
        question: 'How do I connect Stripe for payments?',
        answer: 'Go to Profile > Payments and tap "Connect Stripe". Follow the setup wizard to link your bank account. Clients can then pay online.',
      },
      {
        question: 'How do I record a payment?',
        answer: 'Open an invoice and tap "Record Payment". Enter the amount, date, and payment method. The invoice status will update automatically.',
      },
      {
        question: 'How do I handle overdue invoices?',
        answer: 'JobRunner can send automatic reminders. Go to Profile > Automations to set up overdue payment reminders. You can also manually send reminders from any invoice.',
      },
    ],
  },
  {
    id: 'team-management',
    title: 'Team Management',
    icon: 'users',
    items: [
      {
        question: 'How do I add team members?',
        answer: 'Go to Profile > Team Management and tap "Invite Member". Enter their email and select their role. They\'ll receive an invitation to join your team.',
      },
      {
        question: 'What are the different team roles?',
        answer: 'Admin has full access, Tradies can manage their assigned jobs, and Office Staff can handle quotes and invoices. Customise permissions for each role.',
      },
      {
        question: 'How do I assign jobs to team members?',
        answer: 'When creating or editing a job, use the "Assign to" field to select a team member. They\'ll be notified and can see the job in their dashboard.',
      },
    ],
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    icon: 'tool',
    items: [
      {
        question: 'Emails aren\'t sending - what do I do?',
        answer: 'Check Profile > Integrations to verify your email is connected. Make sure your internet connection is stable and try resending. Contact support if issues persist.',
      },
      {
        question: 'Stripe connection issues?',
        answer: 'Go to Profile > Payments and check your connection status. You may need to re-authenticate. Ensure your Stripe account is fully verified.',
      },
      {
        question: 'Data isn\'t syncing across devices?',
        answer: 'Make sure you\'re signed in with the same account on all devices. Check your internet connection. Pull down to refresh any screen to force a sync.',
      },
      {
        question: 'PDF quotes/invoices look wrong?',
        answer: 'Check your business settings and branding are complete. Try regenerating the PDF. If issues persist, contact support with a screenshot.',
      },
      {
        question: 'How do I request a new feature?',
        answer: 'We love feedback! Email us at admin@avwebinnovation.com with your feature request. We review all suggestions for future updates.',
      },
    ],
  },
];

const createStyles = (colors: ThemeColors, bottomNavHeight: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: bottomNavHeight,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  headerIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  headerTitle: {
    ...typography.pageTitle,
    color: colors.foreground,
    textAlign: 'center',
  },
  headerSubtitle: {
    ...typography.body,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  tourCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    padding: spacing.lg,
    marginBottom: spacing.xl,
    borderWidth: 2,
    borderColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    ...shadows.sm,
  },
  tourIconContainer: {
    width: 48,
    height: 48,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tourContent: {
    flex: 1,
  },
  tourTitle: {
    ...typography.subtitle,
    color: colors.foreground,
    marginBottom: 2,
  },
  tourSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  sectionTitle: {
    ...typography.label,
    color: colors.mutedForeground,
    marginBottom: spacing.sm,
    paddingLeft: spacing.xs,
  },
  faqSection: {
    marginBottom: spacing.xl,
  },
  categoryCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    overflow: 'hidden',
    ...shadows.sm,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  categoryIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryTitle: {
    flex: 1,
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
  },
  categoryItems: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  faqItemLast: {
    borderBottomWidth: 0,
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    paddingLeft: spacing.xl,
    gap: spacing.md,
  },
  faqQuestionText: {
    flex: 1,
    ...typography.body,
    color: colors.foreground,
  },
  faqAnswer: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  faqAnswerText: {
    ...typography.body,
    color: colors.mutedForeground,
    lineHeight: 22,
  },
  contactSection: {
    marginBottom: spacing.xl,
  },
  contactCard: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadows.sm,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    gap: spacing.md,
  },
  contactItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  contactIconContainer: {
    width: 40,
    height: 40,
    borderRadius: radius.lg,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contactContent: {
    flex: 1,
  },
  contactTitle: {
    ...typography.body,
    fontWeight: fontWeights.medium,
    color: colors.foreground,
  },
  contactSubtitle: {
    ...typography.caption,
    color: colors.mutedForeground,
    marginTop: 2,
  },
  footer: {
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  footerText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
  versionText: {
    ...typography.captionSmall,
    color: colors.mutedForeground,
    marginTop: spacing.xs,
  },
  debugRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  debugLabel: {
    ...typography.caption,
    color: colors.mutedForeground,
    flex: 1,
  },
  debugValue: {
    ...typography.caption,
    color: colors.foreground,
    flex: 1,
    textAlign: 'right',
  },
  copyDebugButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    marginTop: spacing.md,
  },
  copyDebugText: {
    ...typography.bodySmall,
    fontWeight: fontWeights.semibold,
  },
});

interface AccordionCategoryProps {
  category: FAQCategory;
  isExpanded: boolean;
  onToggle: () => void;
  expandedItems: Set<string>;
  onToggleItem: (itemKey: string) => void;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}

function AccordionCategory({ 
  category, 
  isExpanded, 
  onToggle, 
  expandedItems, 
  onToggleItem,
  colors,
  styles 
}: AccordionCategoryProps) {
  const rotateAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(rotateAnim, {
      toValue: isExpanded ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    onToggle();
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={styles.categoryCard}>
      <PressableRow style={styles.categoryHeader} onPress={handleToggle} >
        <View style={styles.categoryIconContainer}>
          <Feather name={category.icon} size={iconSizes.lg} color={colors.primary} />
        </View>
        <Text style={styles.categoryTitle}>{category.title}</Text>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Feather name="chevron-down" size={iconSizes.lg} color={colors.mutedForeground} />
        </Animated.View>
      </PressableRow>

      {isExpanded && (
        <View style={styles.categoryItems}>
          {category.items.map((item, index) => {
            const itemKey = `${category.id}-${index}`;
            const isItemExpanded = expandedItems.has(itemKey);
            
            return (
              <FAQItemComponent
                key={itemKey}
                item={item}
                isExpanded={isItemExpanded}
                onToggle={() => onToggleItem(itemKey)}
                isLast={index === category.items.length - 1}
                colors={colors}
                styles={styles}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

interface FAQItemComponentProps {
  item: FAQItem;
  isExpanded: boolean;
  onToggle: () => void;
  isLast: boolean;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}

function FAQItemComponent({ item, isExpanded, onToggle, isLast, colors, styles }: FAQItemComponentProps) {
  const rotateAnim = useRef(new Animated.Value(isExpanded ? 1 : 0)).current;

  const handleToggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(rotateAnim, {
      toValue: isExpanded ? 0 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
    onToggle();
  };

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  return (
    <View style={[styles.faqItem, isLast && styles.faqItemLast]}>
      <PressableRow style={styles.faqQuestion} onPress={handleToggle} >
        <Text style={styles.faqQuestionText}>{item.question}</Text>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Feather name="chevron-down" size={iconSizes.md} color={colors.mutedForeground} />
        </Animated.View>
      </PressableRow>
      
      {isExpanded && (
        <View style={styles.faqAnswer}>
          <Text style={styles.faqAnswerText}>{item.answer}</Text>
        </View>
      )}
    </View>
  );
}

export default function SupportScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  const [showTour, setShowTour] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const toggleItem = (itemKey: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(itemKey)) {
        next.delete(itemKey);
      } else {
        next.add(itemKey);
      }
      return next;
    });
  };

  const { isOnline, isSyncing, pendingSyncCount, lastSyncTime } = useOfflineStore();
  const user = useAuthStore((state: any) => state.user);

  const debugInfo = useMemo(() => {
    const appVersion = Application.nativeApplicationVersion || '1.1.0';
    const buildNumber = Application.nativeBuildVersion || 'dev';
    const sdkVersion = Constants.expoConfig?.sdkVersion || 'unknown';
    const deviceModel = Device.modelName || 'unknown';
    const osName = Platform.OS;
    const osVersion = Platform.Version?.toString() || 'unknown';
    const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'default';
    const lastSync = lastSyncTime ? new Date(lastSyncTime).toLocaleString('en-AU') : 'Never';
    
    return {
      'App Version': `${appVersion} (${buildNumber})`,
      'Expo SDK': sdkVersion,
      'Platform': `${osName} ${osVersion}`,
      'Device': deviceModel,
      'User ID': user?.id?.toString() || 'Not logged in',
      'Online': isOnline ? 'Yes' : 'No',
      'Syncing': isSyncing ? 'Yes' : 'No',
      'Pending Sync': pendingSyncCount.toString(),
      'Last Sync': lastSync,
      'API Endpoint': apiUrl,
    };
  }, [isOnline, isSyncing, pendingSyncCount, lastSyncTime, user]);

  const handleCopyDebugInfo = async () => {
    const lines = Object.entries(debugInfo).map(([key, value]) => `${key}: ${value}`);
    const text = `--- JobRunner Debug Info ---\n${lines.join('\n')}\nTimestamp: ${new Date().toISOString()}\n---`;
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Debug info copied to clipboard. You can paste it in a support email.');
  };

  const handleEmailSupport = () => {
    Linking.openURL('mailto:admin@avwebinnovation.com');
  };

  const handleOpenDocs = () => {
    Linking.openURL('https://jobrunner.com.au/docs');
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Help & Support',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
        }} 
      />
      
      <ScrollView style={styles.container}>
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Feather name="help-circle" size={28} color={colors.primary} />
            </View>
            <Text style={styles.headerTitle}>Help & Support</Text>
            <Text style={styles.headerSubtitle}>
              Get help and find answers to common questions
            </Text>
          </View>

          <PressableRow style={styles.tourCard} onPress={() => setShowTour(true)} >
            <View style={styles.tourIconContainer}>
              <Feather name="navigation" size={iconSizes.xl} color={colors.primary} />
            </View>
            <View style={styles.tourContent}>
              <Text style={styles.tourTitle}>Start App Tour</Text>
              <Text style={styles.tourSubtitle}>Take a guided walkthrough of the app</Text>
            </View>
            <Feather name="chevron-right" size={iconSizes.lg} color={colors.mutedForeground} />
          </PressableRow>

          <View style={styles.faqSection}>
            <Text style={styles.sectionTitle}>FREQUENTLY ASKED QUESTIONS</Text>
            
            {FAQ_CATEGORIES.map(category => (
              <AccordionCategory
                key={category.id}
                category={category}
                isExpanded={expandedCategories.has(category.id)}
                onToggle={() => toggleCategory(category.id)}
                expandedItems={expandedItems}
                onToggleItem={toggleItem}
                colors={colors}
                styles={styles}
              />
            ))}
          </View>

          <View style={styles.contactSection}>
            <Text style={styles.sectionTitle}>REPORT A PROBLEM</Text>
            
            <PressableRow style={[styles.tourCard, { borderColor: colors.destructive }]} onPress={() => router.push('/more/report-bug')} >
              <View style={[styles.tourIconContainer, { backgroundColor: colors.destructive + '20' }]}>
                <Feather name="alert-circle" size={iconSizes.xl} color={colors.destructive} />
              </View>
              <View style={styles.tourContent}>
                <Text style={styles.tourTitle}>Report a Bug</Text>
                <Text style={styles.tourSubtitle}>Something not working? Let us know!</Text>
              </View>
              <Feather name="chevron-right" size={iconSizes.lg} color={colors.mutedForeground} />
            </PressableRow>

            <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>CONTACT US</Text>
            
            <View style={styles.contactCard}>
              <PressableRow style={[styles.contactItem, styles.contactItemBorder]} onPress={handleEmailSupport} >
                <View style={styles.contactIconContainer}>
                  <Feather name="mail" size={iconSizes.lg} color={colors.primary} />
                </View>
                <View style={styles.contactContent}>
                  <Text style={styles.contactTitle}>Email Support</Text>
                  <Text style={styles.contactSubtitle}>admin@avwebinnovation.com</Text>
                </View>
                <Feather name="external-link" size={iconSizes.md} color={colors.mutedForeground} />
              </PressableRow>

              <PressableRow style={styles.contactItem} onPress={handleOpenDocs} >
                <View style={styles.contactIconContainer}>
                  <Feather name="book-open" size={iconSizes.lg} color={colors.primary} />
                </View>
                <View style={styles.contactContent}>
                  <Text style={styles.contactTitle}>Documentation</Text>
                  <Text style={styles.contactSubtitle}>Browse guides and tutorials</Text>
                </View>
                <Feather name="external-link" size={iconSizes.md} color={colors.mutedForeground} />
              </PressableRow>
            </View>
          </View>

          <Text style={[styles.sectionTitle, { marginTop: spacing.xl }]}>DEBUG INFO</Text>
          <View style={styles.contactCard}>
            {Object.entries(debugInfo).map(([key, value], index, arr) => (
              <View
                key={key}
                style={[
                  styles.debugRow,
                  index < arr.length - 1 && styles.contactItemBorder,
                ]}
              >
                <Text style={styles.debugLabel}>{key}</Text>
                <Text style={styles.debugValue} selectable>{value}</Text>
              </View>
            ))}
          </View>
          <PressableRow style={[styles.copyDebugButton, { backgroundColor: colors.primary }]} onPress={handleCopyDebugInfo} >
            <Feather name="copy" size={iconSizes.md} color={colors.primaryForeground} />
            <Text style={[styles.copyDebugText, { color: colors.primaryForeground }]}>Copy Debug Info</Text>
          </PressableRow>

          <View style={styles.footer}>
            <Text style={styles.footerText}>JobRunner Mobile</Text>
            <Text style={styles.versionText}>Version {debugInfo['App Version']}</Text>
          </View>
        </View>
      </ScrollView>

      <AppTour visible={showTour} onClose={() => setShowTour(false)} />
    </>
  );
}
