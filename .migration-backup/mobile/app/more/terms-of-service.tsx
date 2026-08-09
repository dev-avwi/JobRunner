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
  warningBox: {
    backgroundColor: colors.destructiveLight || colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.destructive,
  },
  warningText: {
    ...typography.body,
    color: colors.foreground,
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

export default function TermsOfServiceScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Terms of Service',
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
            Welcome to JobRunner. These Terms of Service ("Terms") constitute a legally binding agreement between you and LinkUp2Care Pty Ltd (ABN 34 692 409 448) trading as JobRunner ("JobRunner", "we", "us", or "our") governing your access to and use of our mobile application and related services.
          </Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            These Terms are governed by Australian law and are designed for Australian tradespeople and service businesses.
          </Text>
        </View>

        <View style={styles.highlightBox}>
          <Text style={styles.highlightText}>
            By creating an account, accessing, or using JobRunner, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>1. Acceptance of Terms</Text>
          <Text style={styles.paragraph}>
            By accessing or using JobRunner, you confirm that:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="You are at least 18 years of age" colors={colors} styles={styles} />
            <BulletItem text="You have the legal capacity to enter into a binding agreement" colors={colors} styles={styles} />
            <BulletItem text="You are using the service for lawful business purposes" colors={colors} styles={styles} />
            <BulletItem text="All registration information you provide is accurate and complete" colors={colors} styles={styles} />
            <BulletItem text="You will maintain the accuracy of such information" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            If you do not agree to these Terms, you must not access or use JobRunner. If you are accepting these Terms on behalf of a company or other legal entity, you represent that you have the authority to bind that entity.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>2. Description of Service</Text>
          <Text style={styles.paragraph}>
            JobRunner is a comprehensive business management platform designed specifically for Australian tradespeople and service businesses. Our services include:
          </Text>
          
          <Text style={styles.subSectionTitle}>Job Management</Text>
          <View style={styles.bulletList}>
            <BulletItem text="Creating, scheduling, and tracking jobs" colors={colors} styles={styles} />
            <BulletItem text="Job site location tracking and mapping" colors={colors} styles={styles} />
            <BulletItem text="Photo documentation (before/after)" colors={colors} styles={styles} />
            <BulletItem text="Digital signatures and completion certificates" colors={colors} styles={styles} />
            <BulletItem text="Job notes, checklists, and custom forms" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Invoicing and Quotes</Text>
          <View style={styles.bulletList}>
            <BulletItem text="Professional quote and invoice generation" colors={colors} styles={styles} />
            <BulletItem text="Customisable templates with your branding" colors={colors} styles={styles} />
            <BulletItem text="Automated payment reminders" colors={colors} styles={styles} />
            <BulletItem text="GST calculation and reporting" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Payment Processing</Text>
          <View style={styles.bulletList}>
            <BulletItem text="Online payment collection via Stripe" colors={colors} styles={styles} />
            <BulletItem text="Credit card, debit card, and bank transfer acceptance" colors={colors} styles={styles} />
            <BulletItem text="Payment tracking and reconciliation" colors={colors} styles={styles} />
            <BulletItem text="Deposit and progress payment collection" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Additional Features</Text>
          <View style={styles.bulletList}>
            <BulletItem text="Client relationship management (CRM)" colors={colors} styles={styles} />
            <BulletItem text="Time tracking and timesheets" colors={colors} styles={styles} />
            <BulletItem text="Team management and job dispatch" colors={colors} styles={styles} />
            <BulletItem text="Expense tracking and reporting" colors={colors} styles={styles} />
            <BulletItem text="Calendar and scheduling tools" colors={colors} styles={styles} />
          </View>

          <Text style={[styles.paragraph, styles.lastParagraph]}>
            We may add, modify, suspend, or discontinue features at our discretion. We will provide reasonable notice of material changes where practicable.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>3. Account Responsibilities</Text>
          <Text style={styles.paragraph}>
            As a JobRunner user, you are responsible for:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Maintaining the confidentiality of your login credentials" colors={colors} styles={styles} />
            <BulletItem text="All activities that occur under your account" colors={colors} styles={styles} />
            <BulletItem text="Ensuring your team members comply with these Terms" colors={colors} styles={styles} />
            <BulletItem text="Immediately notifying us of any unauthorised access" colors={colors} styles={styles} />
            <BulletItem text="Keeping your contact and business information up to date" colors={colors} styles={styles} />
          </View>
          
          <Text style={styles.subSectionTitle}>Prohibited Conduct</Text>
          <Text style={styles.paragraph}>
            You agree not to:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Use the service for any unlawful purpose" colors={colors} styles={styles} />
            <BulletItem text="Share your account credentials with unauthorised parties" colors={colors} styles={styles} />
            <BulletItem text="Attempt to gain unauthorised access to our systems" colors={colors} styles={styles} />
            <BulletItem text="Interfere with or disrupt the service or servers" colors={colors} styles={styles} />
            <BulletItem text="Reverse engineer, decompile, or disassemble the app" colors={colors} styles={styles} />
            <BulletItem text="Use automated systems to access the service without permission" colors={colors} styles={styles} />
            <BulletItem text="Transmit viruses, malware, or other harmful code" colors={colors} styles={styles} />
            <BulletItem text="Violate any applicable Australian laws or regulations" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            Violation of these terms may result in immediate account suspension or termination.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>4. Payment Terms</Text>
          
          <Text style={styles.subSectionTitle}>Subscription Plans</Text>
          <Text style={styles.paragraph}>
            JobRunner offers both free and paid subscription plans. For paid plans:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Subscriptions are available on monthly or annual billing cycles" colors={colors} styles={styles} />
            <BulletItem text="All prices are quoted in Australian Dollars (AUD)" colors={colors} styles={styles} />
            <BulletItem text="Prices include GST where applicable" colors={colors} styles={styles} />
            <BulletItem text="Subscriptions automatically renew unless cancelled" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Payment Processing</Text>
          <Text style={styles.paragraph}>
            All payments are processed securely through Stripe. By providing payment information, you:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Authorise us to charge your payment method for subscription fees" colors={colors} styles={styles} />
            <BulletItem text="Confirm your payment information is accurate and current" colors={colors} styles={styles} />
            <BulletItem text="Agree to Stripe's terms of service for payment processing" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Transaction Fees</Text>
          <Text style={styles.paragraph}>
            When you collect payments from your clients through JobRunner, standard payment processing fees apply. These are disclosed before you enable payment collection.
          </Text>

          <Text style={styles.subSectionTitle}>Refunds</Text>
          <View style={styles.bulletList}>
            <BulletItem text="Monthly subscriptions: No refunds for partial months" colors={colors} styles={styles} />
            <BulletItem text="Annual subscriptions: Pro-rata refund within first 14 days" colors={colors} styles={styles} />
            <BulletItem text="Refund requests should be sent to admin@avwebinnovation.com" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Price Changes</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            We reserve the right to change subscription prices with 30 days written notice. Price changes will take effect at the start of your next billing cycle.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>5. Intellectual Property</Text>
          
          <Text style={styles.subSectionTitle}>Our Intellectual Property</Text>
          <Text style={styles.paragraph}>
            JobRunner, including all software, design, trademarks, logos, content, and documentation, is owned by LinkUp2Care Pty Ltd (ABN 34 692 409 448) and is protected by Australian and international intellectual property laws.
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="We grant you a limited, non-exclusive, non-transferable licence to use the app" colors={colors} styles={styles} />
            <BulletItem text="This licence is solely for your internal business purposes" colors={colors} styles={styles} />
            <BulletItem text="You may not copy, modify, distribute, or create derivative works" colors={colors} styles={styles} />
            <BulletItem text="All rights not expressly granted are reserved by JobRunner" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Your Content</Text>
          <Text style={styles.paragraph}>
            You retain ownership of all content you create or upload to JobRunner ("Your Content"), including:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Client information and job details" colors={colors} styles={styles} />
            <BulletItem text="Photos, documents, and files you upload" colors={colors} styles={styles} />
            <BulletItem text="Quotes, invoices, and custom templates" colors={colors} styles={styles} />
            <BulletItem text="Business branding and logos" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            By uploading content, you grant us a limited licence to store, process, and display Your Content solely to provide our services to you. We will not use Your Content for any other purpose without your consent.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>6. Invoice & Document Accuracy</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            You are responsible for reviewing all quotes, invoices, and other documents generated through the platform before sending them to clients. JobRunner provides calculation tools as a convenience but does not guarantee the accuracy of rates, quantities, totals, or GST calculations. You acknowledge that all financial documents should be verified before distribution.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>7. Time Tracking Disclaimer</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            Time tracking data may be affected by device performance, background app restrictions, GPS availability, battery life, and network connectivity. Recorded hours are provided as a guide and may not reflect exact working times. You are responsible for verifying all tracked time before submitting timesheets or generating invoices from time data.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>8. GPS & Location Data</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            GPS location data may be inaccurate or temporarily unavailable due to signal interference, indoor environments, weather conditions, or device limitations. The platform logs GPS accuracy metrics where available but does not guarantee location precision. JobRunner is not liable for disputes arising from GPS location discrepancies. Users should verify location records where accuracy is critical.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>9. Edited Records & Audit Trail</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            When time entries or other records are manually edited, the original values and the identity of the person who made the change are logged within the system. Users acknowledge that manual adjustments override originally tracked data and that these edit logs may be used for audit and dispute resolution purposes. Employers and employees should review edit histories when verifying timesheets.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>10. No Escrow / Payment Intermediary</Text>
          <Text style={styles.paragraph}>
            JobRunner does not act as an escrow service, financial intermediary, or payment guarantor between you and your clients. All payment processing is handled by Stripe, a PCI-DSS compliant third-party payment processor. JobRunner does not store credit card information directly. You are responsible for following up on unpaid invoices and managing payment disputes directly with your clients.
          </Text>
          <Text style={styles.subSectionTitle}>Stripe Connected Account Agreement</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            Payment processing services for users on JobRunner are provided by Stripe and are subject to the Stripe Connected Account Agreement, which includes the Stripe Terms of Service (collectively, the "Stripe Services Agreement"). By agreeing to these terms or continuing to operate as a user on JobRunner, you agree to be bound by the Stripe Services Agreement, as the same may be modified by Stripe from time to time. As a condition of JobRunner enabling payment processing services through Stripe, you agree to provide JobRunner accurate and complete information about you and your business, and you authorise JobRunner to share it and transaction information related to your use of the payment processing services provided by Stripe.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>11. Limitation of Liability</Text>
          
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              Important: Please read this section carefully as it limits our liability to you.
            </Text>
          </View>

          <Text style={styles.paragraph}>
            To the maximum extent permitted by Australian law:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="JobRunner is provided 'as is' and 'as available' without warranties of any kind, express or implied" colors={colors} styles={styles} />
            <BulletItem text="We do not warrant that the service will be uninterrupted, error-free, or completely secure" colors={colors} styles={styles} />
            <BulletItem text="We are not liable for any indirect, incidental, special, consequential, or punitive damages" colors={colors} styles={styles} />
            <BulletItem text="We are not liable for lost profits, data loss, or business interruption" colors={colors} styles={styles} />
            <BulletItem text="Our total liability is limited to the amount you paid us in the 12 months preceding the claim" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Specific Exclusions</Text>
          <View style={styles.bulletList}>
            <BulletItem text="We are not responsible for the accuracy of information you enter" colors={colors} styles={styles} />
            <BulletItem text="We are not liable for disputes between you and your clients" colors={colors} styles={styles} />
            <BulletItem text="We are not responsible for third-party payment processing failures" colors={colors} styles={styles} />
            <BulletItem text="We are not liable for losses caused by your failure to secure your account" colors={colors} styles={styles} />
          </View>

          <Text style={styles.paragraph}>
            These limitations apply to the fullest extent permitted by law and survive any termination of these Terms.
          </Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            JobRunner is not responsible for data loss resulting from user device failure, improper use, third-party service outages, or events beyond reasonable control. While we maintain regular backups and data redundancy measures, we recommend you export critical business data periodically.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>12. Australian Consumer Law</Text>
          <Text style={styles.paragraph}>
            Nothing in these Terms is intended to exclude, restrict, or modify rights you may have under the Australian Consumer Law (Schedule 2 of the Competition and Consumer Act 2010 (Cth)) ("ACL") that cannot be excluded, restricted, or modified by agreement.
          </Text>
          <Text style={styles.paragraph}>
            If the ACL applies to you as a consumer:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Our services come with guarantees that cannot be excluded under the ACL" colors={colors} styles={styles} />
            <BulletItem text="You are entitled to a replacement or refund for a major failure" colors={colors} styles={styles} />
            <BulletItem text="You are entitled to compensation for any other reasonably foreseeable loss or damage" colors={colors} styles={styles} />
            <BulletItem text="You are entitled to have services re-supplied or refunded if they fail to meet consumer guarantees" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            To the extent we are permitted to limit our liability under the ACL, our liability for breach of a consumer guarantee is limited to re-supplying the services or paying the cost of having them re-supplied.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>13. Dispute Resolution</Text>
          <Text style={styles.paragraph}>
            We are committed to resolving disputes fairly and efficiently. If you have a dispute with JobRunner:
          </Text>
          
          <Text style={styles.subSectionTitle}>Step 1: Direct Resolution</Text>
          <Text style={styles.paragraph}>
            Contact our support team at admin@avwebinnovation.com. We aim to resolve most issues within 10 business days.
          </Text>

          <Text style={styles.subSectionTitle}>Step 2: Formal Complaint</Text>
          <Text style={styles.paragraph}>
            If not resolved, submit a formal written complaint to admin@avwebinnovation.com. We will acknowledge receipt within 5 business days and provide a substantive response within 21 business days.
          </Text>

          <Text style={styles.subSectionTitle}>Step 3: Mediation</Text>
          <Text style={styles.paragraph}>
            If the dispute remains unresolved, either party may refer it to mediation through the Resolution Institute or a mutually agreed mediator. Costs will be shared equally unless otherwise agreed.
          </Text>

          <Text style={styles.subSectionTitle}>Step 4: Legal Proceedings</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            If mediation is unsuccessful, either party may commence legal proceedings. Any legal action must be brought in the courts of Queensland, Australia, and you consent to the exclusive jurisdiction of those courts.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>14. Termination</Text>
          
          <Text style={styles.subSectionTitle}>Termination by You</Text>
          <Text style={styles.paragraph}>
            You may cancel your account at any time through the app settings or by contacting admin@avwebinnovation.com. Upon cancellation:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Your subscription will remain active until the end of the current billing period" colors={colors} styles={styles} />
            <BulletItem text="Your account reverts to the free plan with its associated limits" colors={colors} styles={styles} />
            <BulletItem text="All your business data is retained for 12 months after cancellation" colors={colors} styles={styles} />
            <BulletItem text="You can resubscribe at any time during this period to regain full access" colors={colors} styles={styles} />
            <BulletItem text="After 12 months, non-financial data may be permanently deleted" colors={colors} styles={styles} />
            <BulletItem text="Financial records are retained for 5-7 years as required by Australian tax law" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Pausing Your Subscription</Text>
          <Text style={styles.paragraph}>
            You may pause your subscription at any time. While paused, no billing occurs and your account reverts to the free plan. All data is preserved and you can resume your subscription at any time to restore full access.
          </Text>

          <Text style={styles.subSectionTitle}>Termination by Us</Text>
          <Text style={styles.paragraph}>
            We may suspend or terminate your account if:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="You breach these Terms of Service" colors={colors} styles={styles} />
            <BulletItem text="You fail to pay subscription fees when due" colors={colors} styles={styles} />
            <BulletItem text="We are required to do so by law" colors={colors} styles={styles} />
            <BulletItem text="Your use poses a security risk or legal liability" colors={colors} styles={styles} />
            <BulletItem text="Your account has been inactive for more than 24 months" colors={colors} styles={styles} />
          </View>

          <Text style={styles.subSectionTitle}>Effect of Termination</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            Upon termination, your right to use JobRunner ceases immediately. Sections that by their nature should survive termination will survive, including intellectual property rights, limitation of liability, indemnification, and dispute resolution.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>15. AI Receptionist Service</Text>
          <Text style={styles.paragraph}>
            JobRunner offers an AI Receptionist feature that can handle incoming SMS messages on behalf of your business. By enabling this feature, you acknowledge and agree to the following:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="The AI Receptionist is designed for information collection and initial customer enquiry handling only. It does not confirm jobs, provide quotes, or make commitments on behalf of your business" colors={colors} styles={styles} />
            <BulletItem text="All job details, quotes, and scheduling communicated by the AI Receptionist must be confirmed by you, the business owner, before any work is undertaken" colors={colors} styles={styles} />
            <BulletItem text="The AI Receptionist may misinterpret customer messages or provide incomplete responses. You are responsible for reviewing all AI-handled conversations and following up with customers as needed" colors={colors} styles={styles} />
            <BulletItem text="The AI Receptionist records and transcribes incoming calls and plays an automated greeting informing callers that they are interacting with an AI system and that the call is being recorded. As the subscriber, you are responsible for ensuring your callers are informed of, and where required consent to, the recording of calls, in compliance with the Telecommunications (Interception and Access) Act 1979 (Cth) and applicable Australian state and territory surveillance devices legislation" colors={colors} styles={styles} />
            <BulletItem text="SMS messages sent and received through the AI Receptionist are stored in accordance with our Privacy Policy and may be retained for quality assurance and dispute resolution purposes" colors={colors} styles={styles} />
            <BulletItem text="JobRunner is not liable for any miscommunication, missed enquiries, lost business, or customer disputes arising from the AI Receptionist's responses" colors={colors} styles={styles} />
            <BulletItem text="You are responsible for ensuring that any information the AI Receptionist provides to your customers is accurate and up-to-date by maintaining current business details in your settings" colors={colors} styles={styles} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>15A. AI-Generated Content</Text>
          <Text style={styles.paragraph}>
            JobRunner uses artificial intelligence to generate quote descriptions and job summaries, analyse and categorise photos, scan receipts, and detect potential safety hazards. By using these features, you acknowledge and agree that:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="AI-generated content is provided as a suggestion only and may contain errors, omissions, or inaccuracies" colors={colors} styles={styles} />
            <BulletItem text="You are solely responsible for reviewing, verifying, and approving all AI-generated content before relying on or acting upon it" colors={colors} styles={styles} />
            <BulletItem text="AI-generated content should not be relied upon as professional, legal, financial, trade, or safety advice" colors={colors} styles={styles} />
            <BulletItem text="JobRunner accepts no liability for any loss, cost, or damage arising from decisions made in reliance on AI-generated content" colors={colors} styles={styles} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>15B. Commercial Electronic Messages</Text>
          <Text style={styles.paragraph}>
            JobRunner sends automated SMS and email communications on your behalf, including booking confirmations, payment reminders, review requests, and customer follow-ups. By using these features:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="You are responsible for ensuring you have the necessary consent from your customers to receive commercial electronic messages before they are sent through the platform, as required by the Spam Act 2003 (Cth)" colors={colors} styles={styles} />
            <BulletItem text="All marketing and commercial messages sent through the platform include a functional unsubscribe or opt-out mechanism, and you must honour any opt-out requests promptly" colors={colors} styles={styles} />
            <BulletItem text="You agree to comply with the Spam Act 2003 (Cth) and the Do Not Call Register Act 2006 (Cth) when contacting your customers" colors={colors} styles={styles} />
            <BulletItem text="JobRunner reserves the right to suspend messaging functionality if we detect misuse, including sending unsolicited commercial messages" colors={colors} styles={styles} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>15C. Safety & WHS Tools Disclaimer</Text>
          <Text style={styles.paragraph}>
            JobRunner provides work health and safety (WHS) tools, including Safe Work Method Statement (SWMS) templates, risk matrices, worker sign-off, and AI-assisted hazard detection. These features are provided as tools only.
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="You remain solely responsible for compliance with all applicable Work Health and Safety legislation, regulations, and codes of practice in your state or territory" colors={colors} styles={styles} />
            <BulletItem text="JobRunner makes no warranty that any document generated using these tools meets any specific legal, regulatory, or industry standard, or is suitable for your particular work, site, or circumstances" colors={colors} styles={styles} />
            <BulletItem text="You are responsible for reviewing, completing, and verifying all safety documents before relying on them, and for ensuring hazards are properly identified and controlled on site" colors={colors} styles={styles} />
            <BulletItem text="JobRunner is not liable for any injury, loss, penalty, or damage arising from your use of, or reliance on, the safety and WHS tools" colors={colors} styles={styles} />
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>16. Changes to Terms</Text>
          <Text style={styles.paragraph}>
            We may update these Terms from time to time to reflect changes in our services, legal requirements, or business practices.
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="Material changes will be notified via email or in-app notification at least 30 days before taking effect" colors={colors} styles={styles} />
            <BulletItem text="Minor changes may be made without notice" colors={colors} styles={styles} />
            <BulletItem text="The current version will always be available within the app" colors={colors} styles={styles} />
            <BulletItem text="Continued use after changes constitutes acceptance" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            If you do not agree to updated Terms, you may terminate your account before the changes take effect.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>17. General Provisions</Text>
          
          <Text style={styles.subSectionTitle}>Governing Law</Text>
          <Text style={styles.paragraph}>
            These Terms are governed by the laws of Queensland, Australia. You agree to submit to the exclusive jurisdiction of the courts of Queensland.
          </Text>

          <Text style={styles.subSectionTitle}>Entire Agreement</Text>
          <Text style={styles.paragraph}>
            These Terms, together with our Privacy Policy, constitute the entire agreement between you and JobRunner regarding the use of our services.
          </Text>

          <Text style={styles.subSectionTitle}>Severability</Text>
          <Text style={styles.paragraph}>
            If any provision of these Terms is found to be unenforceable, the remaining provisions will continue in full force and effect.
          </Text>

          <Text style={styles.subSectionTitle}>Waiver</Text>
          <Text style={styles.paragraph}>
            Our failure to enforce any right or provision does not constitute a waiver of that right or provision.
          </Text>

          <Text style={styles.subSectionTitle}>Assignment</Text>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            You may not assign or transfer these Terms without our written consent. We may assign our rights and obligations to a successor in connection with a merger, acquisition, or sale of assets.
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>18. Contact Information</Text>
          <Text style={styles.paragraph}>
            If you have any questions about these Terms of Service, please contact us:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="LinkUp2Care Pty Ltd trading as JobRunner" colors={colors} styles={styles} />
            <BulletItem text="ABN: 34 692 409 448" colors={colors} styles={styles} />
            <BulletItem text="Email: admin@avwebinnovation.com" colors={colors} styles={styles} />
            <BulletItem text="Phone: 0458 300 051" colors={colors} styles={styles} />
            <BulletItem text="Website: www.jobrunner.com.au" colors={colors} styles={styles} />
          </View>
          <Text style={[styles.paragraph, styles.lastParagraph]}>
            We aim to respond to all enquiries within 5 business days.
          </Text>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Last Updated: April 2026</Text>
          <Text style={styles.footerText}>Version 3.1</Text>
        </View>
      </ScrollView>
    </>
  );
}
