import { useMemo } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet 
} from 'react-native';
import { Stack } from 'expo-router';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, shadows, typography, fontWeights } from '../../src/lib/design-tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';

const createStyles = (colors: ThemeColors, bottomNavHeight: number = 0) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: bottomNavHeight,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  sectionTitle: {
    ...typography.cardTitle,
    color: colors.foreground,
    marginBottom: spacing.md,
  },
  subSectionTitle: {
    ...typography.body,
    fontWeight: fontWeights.semibold,
    color: colors.foreground,
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  paragraph: {
    ...typography.body,
    color: colors.foreground,
    lineHeight: 24,
    marginBottom: spacing.lg,
  },
  lastParagraph: {
    marginBottom: 0,
  },
  bulletList: {
    marginBottom: spacing.lg,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  bullet: {
    ...typography.body,
    color: colors.primary,
    marginRight: spacing.md,
    lineHeight: 24,
  },
  bulletText: {
    ...typography.body,
    color: colors.foreground,
    flex: 1,
    lineHeight: 24,
  },
  highlightBox: {
    backgroundColor: colors.primaryLight,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  highlightText: {
    ...typography.body,
    color: colors.primary,
    fontWeight: fontWeights.medium,
    lineHeight: 22,
  },
  footer: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    marginTop: spacing.lg,
  },
  footerText: {
    ...typography.caption,
    color: colors.mutedForeground,
  },
});

interface BulletItemProps {
  text: string;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
}

function BulletItem({ text, colors, styles }: BulletItemProps) {
  return (
    <View style={styles.bulletItem}>
      <Text style={styles.bullet}>•</Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

export default function PrivacyPolicyScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Privacy Policy',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
        }} 
      />
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.paragraph}>
            LinkUp2Care Pty Ltd (ABN 34 692 409 448) trading as JobRunner ("JobRunner", "we", "us", or "our") is committed to protecting your privacy and handling your personal information in accordance with the Privacy Act 1988 (Cth) and the Australian Privacy Principles (APPs).
          </Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            This Privacy Policy explains how we collect, use, store, disclose, and protect your personal information when you use our mobile application and related services designed for Australian tradespeople and service businesses.
          </Text>
        </View>

        <View style={styles.highlightBox}>
          <Text style={styles.highlightText}>
            By using JobRunner, you consent to the collection and use of your information as described in this Privacy Policy in accordance with Australian law.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>1. Information We Collect</Text>
          
          <Text style={styles.subSectionTitle}>Personal Information</Text>
          <Text style={styles.paragraph}>
            We collect personal information that you provide directly to us, including:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Full name, email address, and phone number" colors={colors} styles={styles} />
            <BulletItem text="Business name, ABN/ACN, and business address" colors={colors} styles={styles} />
            <BulletItem text="Trade licence numbers and qualifications" colors={colors} styles={styles} />
            <BulletItem text="Profile photo and business logo" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Client Information</Text>
          <Text style={styles.paragraph}>
            Information about your clients that you enter into the app:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Client names, addresses, and contact details" colors={colors} styles={styles} />
            <BulletItem text="Job site locations and property details" colors={colors} styles={styles} />
            <BulletItem text="Job history and service records" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Location Data</Text>
          <Text style={styles.paragraph}>
            With your consent, we collect:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Real-time GPS location for job site check-in/check-out" colors={colors} styles={styles} />
            <BulletItem text="Geofencing data for automatic time tracking" colors={colors} styles={styles} />
            <BulletItem text="Travel routes for mileage tracking (if enabled)" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Photos, Documents & Audio</Text>
          <View style={styles.bulletList}>
            <BulletItem text="Before and after job photos" colors={colors} styles={styles} />
            <BulletItem text="Site inspection images and documentation" colors={colors} styles={styles} />
            <BulletItem text="Signed quotes, contracts, and completion certificates" colors={colors} styles={styles} />
            <BulletItem text="Uploaded receipts and scanned receipt images" colors={colors} styles={styles} />
            <BulletItem text="Voice notes and audio recordings you capture for transcription" colors={colors} styles={styles} />
            <BulletItem text="GPS location and timestamp metadata embedded in photos for job site verification" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Financial Information</Text>
          <View style={styles.bulletList}>
            <BulletItem text="Payment card details (processed securely by Stripe)" colors={colors} styles={styles} />
            <BulletItem text="Bank account details for payment receipts" colors={colors} styles={styles} />
            <BulletItem text="Invoice and quote amounts" colors={colors} styles={styles} />
            <BulletItem text="Expense records and financial reports" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>GPS & Location Data</Text>
          <Text style={styles.paragraph}>
            When enabled, we collect GPS coordinates, accuracy metrics, speed, heading, altitude, and reverse-geocoded addresses during work hours for time tracking, geofencing, and job site verification purposes.
          </Text>

          <Text style={styles.subSectionTitle}>Time Tracking Data</Text>
          <Text style={styles.paragraph}>
            Clock in/out times, break durations, pause events, hourly rates, and a full audit trail of any manual edits made to time entries including who made the change and when.
          </Text>

          <Text style={styles.subSectionTitle}>Device Information</Text>
          <Text style={styles.paragraph}>
            Battery level, charging status, device type, and operating system version to support offline sync and location tracking features.
          </Text>

          <Text style={styles.subSectionTitle}>Technical Information</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            We automatically collect device information, IP address, app version, operating system, crash reports, and usage analytics to improve our services.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>2. How We Use Your Information</Text>
          
          <Text style={styles.subSectionTitle}>Business Operations</Text>
          <View style={styles.bulletList}>
            <BulletItem text="Creating and managing jobs, quotes, and invoices" colors={colors} styles={styles} />
            <BulletItem text="Processing payments and tracking expenses" colors={colors} styles={styles} />
            <BulletItem text="Enabling time tracking and job scheduling" colors={colors} styles={styles} />
            <BulletItem text="Managing client relationships and communications" colors={colors} styles={styles} />
            <BulletItem text="Generating business reports and analytics" colors={colors} styles={styles} />
            <BulletItem text="Provide GPS-based geofencing for automatic job site check-in and check-out" colors={colors} styles={styles} />
            <BulletItem text="Maintain audit trails for time entry edits to support dispute resolution and fair work compliance" colors={colors} styles={styles} />
            <BulletItem text="Generate job profitability reports combining time tracking, material costs, and invoice data" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Service Improvement</Text>
          <View style={styles.bulletList}>
            <BulletItem text="Analysing usage patterns to improve app functionality" colors={colors} styles={styles} />
            <BulletItem text="Developing new features based on user feedback" colors={colors} styles={styles} />
            <BulletItem text="Troubleshooting technical issues and bugs" colors={colors} styles={styles} />
            <BulletItem text="Personalising your experience within the app" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Communications</Text>
          <View style={styles.bulletList}>
            <BulletItem text="Sending transactional emails (invoices, receipts, reminders)" colors={colors} styles={styles} />
            <BulletItem text="Providing customer support and responding to enquiries" colors={colors} styles={styles} />
            <BulletItem text="Sending service updates and important notifications" colors={colors} styles={styles} />
            <BulletItem text="Marketing communications (with your consent)" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Legal Compliance</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            We may use your information to comply with legal obligations, resolve disputes, enforce our terms, and protect our rights and the rights of others.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>3. Data Storage and Security</Text>
          <Text style={styles.paragraph}>
            Your data security is our priority. We implement industry-standard measures to protect your information:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Data is stored on secure cloud servers with encryption at rest" colors={colors} styles={styles} />
            <BulletItem text="All data transmission uses TLS 1.3 encryption" colors={colors} styles={styles} />
            <BulletItem text="Payment information is processed by PCI-DSS compliant Stripe" colors={colors} styles={styles} />
            <BulletItem text="Regular security audits and vulnerability assessments" colors={colors} styles={styles} />
            <BulletItem text="Access controls and multi-factor authentication" colors={colors} styles={styles} />
            <BulletItem text="Automated backups with disaster recovery procedures" colors={colors} styles={styles} />
          </View>
          <Text style={styles.paragraph}>
            While we take reasonable steps to protect your information, no method of electronic storage or transmission is 100% secure. We cannot guarantee absolute security.
          </Text>
          <Text style={styles.subSectionTitle}>Data Retention</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            We retain your personal information for as long as your account is active or as needed to provide services. If you cancel your subscription, all business data is retained for 12 months from the date of cancellation. During this period, you can resubscribe to regain access. After 12 months, non-financial data may be permanently deleted. Financial records are retained for 5-7 years as required by Australian tax law. If you pause your subscription, all data is retained indefinitely until you resume or cancel.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>3A. Location & Time Tracking Data</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            We collect location data only when time tracking or geofencing features are actively enabled by you or your employer. Location tracking can be disabled at any time through your device settings or within the app. Location data is stored securely and is only accessible to the business owner and authorised managers within your organisation. We retain location tracking data for 12 months, after which it is automatically archived. Time entry edit histories are retained for the duration of your account plus 7 years to comply with Australian record-keeping requirements under the Fair Work Act 2009.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>4. Third-Party Services</Text>
          <Text style={styles.paragraph}>
            We share your information with trusted third-party service providers who assist in operating our platform (Stripe for payments, SendGrid for emails, Twilio for SMS, Google Cloud for data storage):
          </Text>
          
          <Text style={styles.subSectionTitle}>Stripe (Payment Processing)</Text>
          <Text style={styles.paragraph}>
            Stripe processes all payment transactions. Your payment card details are handled directly by Stripe and are not stored on our servers. Stripe is PCI-DSS Level 1 certified.
          </Text>

          <Text style={styles.subSectionTitle}>SendGrid (Email Communications)</Text>
          <Text style={styles.paragraph}>
            SendGrid delivers transactional emails including invoices, quotes, and reminders on your behalf to your clients.
          </Text>

          <Text style={styles.subSectionTitle}>Twilio (SMS Notifications)</Text>
          <Text style={styles.paragraph}>
            Twilio provides SMS notification services for job updates, appointment reminders, and client communications.
          </Text>

          <Text style={styles.subSectionTitle}>Google (Maps and Location Services)</Text>
          <Text style={styles.paragraph}>
            Google Maps provides location services, address autocomplete, and mapping functionality for job site navigation.
          </Text>

          <Text style={styles.subSectionTitle}>Cloud Infrastructure</Text>
          <Text style={styles.paragraph}>
            We use secure cloud hosting providers for data storage and application hosting. Data may be stored in Australia or overseas data centres with appropriate security measures.
          </Text>

          <Text style={styles.subSectionTitle}>Vapi.ai (AI Voice Receptionist)</Text>
          <Text style={styles.paragraph}>
            Vapi.ai handles incoming voice calls for the AI Receptionist feature, including call transcription and voice synthesis with Australian accents.
          </Text>

          <Text style={styles.subSectionTitle}>Sentry (Error Tracking)</Text>
          <Text style={styles.paragraph}>
            Sentry collects crash reports and performance data to help us identify and fix technical issues. No personal business data is included in error reports.
          </Text>

          <Text style={styles.subSectionTitle}>Accounting Integrations (Xero, MYOB, QuickBooks)</Text>
          <Text style={styles.paragraph}>
            When you connect your accounting software, we share invoices, payments, and contact data necessary for synchronisation. We only access the data you authorise.
          </Text>

          <Text style={styles.subSectionTitle}>Calendar Integrations (Google Calendar, Outlook)</Text>
          <Text style={styles.paragraph}>
            When you connect your calendar, only job scheduling data is shared for synchronisation purposes.
          </Text>

          <Text style={styles.subSectionTitle}>App Store Payments (Apple, Google Play)</Text>
          <Text style={styles.paragraph}>
            In-app purchases are processed by Apple or Google Play, subject to their respective privacy policies. We receive purchase confirmation but not your payment card details.
          </Text>

          <Text style={[styles.paragraph, styles.lastParagraph]}>
            These providers are contractually bound to protect your information and may only use it for the specific services they provide to us.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>5. Australian Privacy Principles Compliance</Text>
          <Text style={styles.paragraph}>
            We are committed to complying with the 13 Australian Privacy Principles (APPs) under the Privacy Act 1988 (Cth). This includes:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="APP 1: Open and transparent management of personal information" colors={colors} styles={styles} />
            <BulletItem text="APP 2: Allowing anonymity and pseudonymity where practicable" colors={colors} styles={styles} />
            <BulletItem text="APP 3: Collecting only information that is reasonably necessary" colors={colors} styles={styles} />
            <BulletItem text="APP 5: Notifying you about the collection of information" colors={colors} styles={styles} />
            <BulletItem text="APP 6: Using information only for disclosed purposes" colors={colors} styles={styles} />
            <BulletItem text="APP 8: Taking reasonable steps for overseas data transfers" colors={colors} styles={styles} />
            <BulletItem text="APP 11: Taking reasonable steps to secure personal information" colors={colors} styles={styles} />
            <BulletItem text="APP 12: Providing access to personal information on request" colors={colors} styles={styles} />
            <BulletItem text="APP 13: Correcting personal information upon request" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            For the full text of the Australian Privacy Principles, visit the Office of the Australian Information Commissioner (OAIC) website at www.oaic.gov.au.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>6. Your Rights</Text>
          <Text style={styles.paragraph}>
            Under Australian privacy law, you have the following rights:
          </Text>
          
          <Text style={styles.subSectionTitle}>Right to Access</Text>
          <Text style={styles.paragraph}>
            You can request access to the personal information we hold about you at any time. We will respond within 30 days.
          </Text>

          <Text style={styles.subSectionTitle}>Right to Correction</Text>
          <Text style={styles.paragraph}>
            You can request that we correct any inaccurate, incomplete, or outdated personal information. You can also update much of your information directly in the app settings.
          </Text>

          <Text style={styles.subSectionTitle}>Right to Deletion</Text>
          <Text style={styles.paragraph}>
            You can request deletion of your personal information, subject to our legal obligations to retain certain records (e.g., tax and financial records).
          </Text>

          <Text style={styles.subSectionTitle}>Right to Data Portability</Text>
          <Text style={styles.paragraph}>
            You can request an export of your data in a commonly used, machine-readable format.
          </Text>

          <Text style={styles.subSectionTitle}>Right to Opt-Out</Text>
          <Text style={styles.paragraph}>
            You can opt out of marketing communications at any time by using the unsubscribe link in emails or updating your notification preferences in the app.
          </Text>

          <Text style={styles.subSectionTitle}>Right to Complain</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            If you believe we have breached your privacy, you can lodge a complaint with us directly or with the Office of the Australian Information Commissioner (OAIC) at www.oaic.gov.au.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>6A. Data of Our Customers' Clients</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            JobRunner processes the personal information of our customers' clients (e.g., homeowners, tenants, property managers) solely on behalf of our customers. If you are a client of a business that uses JobRunner and you wish to access, correct, or delete your personal information, please contact that business directly. If we receive such a request, we will forward it to the relevant business for them to action in accordance with their obligations under the Privacy Act 1988 (Cth).
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>6B. AI & Machine Learning</Text>
          <Text style={styles.paragraph}>
            We use OpenAI's GPT models to power AI features such as quote generation, photo analysis, receipt scanning, and business suggestions.
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="When you use AI features, relevant context (such as job descriptions or uploaded photos) may be sent to AI service providers for processing" colors={colors} styles={styles} />
            <BulletItem text="AI service providers process this data according to their own privacy policies. We use enterprise-grade API access which does not use your data for model training" colors={colors} styles={styles} />
            <BulletItem text="You can choose not to use AI features without affecting your access to core platform functionality" colors={colors} styles={styles} />
            <BulletItem text="We do not sell, share, or use your business data to train AI models" colors={colors} styles={styles} />
          </View>
          <Text style={styles.subSectionTitle}>AI Receptionist Voice Calls</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            When the AI Receptionist feature is enabled, incoming voice calls are answered by an AI system powered by Vapi.ai. Calls are recorded and transcribed for quality assurance and business purposes. An automated greeting informs callers at the start of each call that they are interacting with an AI system and that the call is being recorded. As the business owner (subscriber), you are responsible for ensuring your callers are informed of, and where required consent to, the recording of calls, in compliance with the Telecommunications (Interception and Access) Act 1979 (Cth) and applicable Australian state and territory surveillance devices legislation.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>7. Cookies and Tracking</Text>
          <Text style={styles.paragraph}>
            Our mobile app may use local storage and similar technologies to:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Remember your preferences and settings" colors={colors} styles={styles} />
            <BulletItem text="Enable offline functionality" colors={colors} styles={styles} />
            <BulletItem text="Analyse app usage and performance" colors={colors} styles={styles} />
            <BulletItem text="Provide personalised experiences" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            You can manage these settings through your device's privacy controls.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>8. Children's Privacy</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            JobRunner is designed for business use by adults and is not intended for children under 18 years of age. We do not knowingly collect personal information from children.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>9. Changes to This Policy</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            We may update this Privacy Policy from time to time to reflect changes in our practices or legal requirements. We will notify you of any material changes via email or in-app notification. Your continued use of JobRunner after such changes constitutes acceptance of the updated policy.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>10. Contact Us</Text>
          <Text style={styles.paragraph}>
            If you have any questions about this Privacy Policy, wish to exercise your privacy rights, or have a complaint, please contact us:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="LinkUp2Care Pty Ltd trading as JobRunner" colors={colors} styles={styles} />
            <BulletItem text="ABN: 34 692 409 448" colors={colors} styles={styles} />
            <BulletItem text="Email: admin@avwebinnovation.com" colors={colors} styles={styles} />
            <BulletItem text="Phone: 0458 300 051" colors={colors} styles={styles} />
            <BulletItem text="Website: www.jobrunner.com.au" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            We aim to respond to all privacy enquiries within 30 days. If you are not satisfied with our response, you may lodge a complaint with the Office of the Australian Information Commissioner (OAIC).
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Last Updated: April 2026</Text>
          <Text style={styles.footerText}>Version 2.1</Text>
        </View>
      </ScrollView>
    </>
  );
}
