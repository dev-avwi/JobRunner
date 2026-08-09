import { useState, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuthStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { spacing, radius, shadows, typography, fontWeights } from '../../src/lib/design-tokens';
import api from '../../src/lib/api';
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
  warningCard: {
    backgroundColor: colors.destructiveLight || '#fef2f2',
    borderRadius: radius.xl,
    borderWidth: 2,
    borderColor: colors.destructive,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  warningIcon: {
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  warningTitle: {
    ...typography.title,
    color: colors.destructive,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  warningText: {
    ...typography.body,
    color: colors.foreground,
    textAlign: 'center',
    lineHeight: 24,
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
  paragraph: {
    ...typography.body,
    color: colors.foreground,
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  bulletList: {
    marginBottom: spacing.lg,
  },
  bulletItem: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
    alignItems: 'flex-start',
  },
  bullet: {
    ...typography.body,
    color: colors.destructive,
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
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  highlightText: {
    ...typography.body,
    color: colors.mutedForeground,
    fontWeight: fontWeights.medium,
    lineHeight: 22,
    textAlign: 'center',
  },
  confirmationSection: {
    backgroundColor: colors.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.xl,
    marginBottom: spacing.lg,
    ...shadows.sm,
  },
  inputLabel: {
    ...typography.label,
    color: colors.foreground,
    marginBottom: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.muted,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...typography.body,
    color: colors.foreground,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  deleteButton: {
    backgroundColor: colors.destructive,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 56,
    ...shadows.md,
  },
  deleteButtonDisabled: {
    backgroundColor: colors.muted,
  },
  deleteButtonText: {
    ...typography.subtitle,
    color: colors.white,
    fontWeight: fontWeights.bold,
  },
  deleteButtonTextDisabled: {
    color: colors.mutedForeground,
  },
  cancelButton: {
    backgroundColor: 'transparent',
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  cancelButtonText: {
    ...typography.body,
    color: colors.foreground,
    fontWeight: fontWeights.semibold,
  },
  legalNote: {
    ...typography.caption,
    color: colors.mutedForeground,
    textAlign: 'center',
    marginTop: spacing.lg,
    lineHeight: 20,
  },
  privacyLink: {
    color: colors.primary,
    textDecorationLine: 'underline',
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

export default function DeleteAccountScreen() {
  const { colors } = useTheme();
  const confirm = useConfirmDialog();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);
  const { logout } = useAuthStore();
  
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  const isConfirmed = confirmText.toLowerCase() === 'delete';
  
  const handleDeleteAccount = async () => {
    if (!isConfirmed) return;
    
    const ok = await confirm({
      title: 'Final Confirmation',
      message: 'This action cannot be undone. Are you absolutely sure you want to permanently delete your account and all data?',
      confirmText: 'Delete Forever',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (ok) {
      await performDeletion();
    }
  };
  
  const performDeletion = async () => {
    setIsDeleting(true);
    
    try {
      const response = await api.delete<{ success: boolean; message: string; deletedCounts?: Record<string, number> }>('/api/account');
      
      if (response.error) {
        Alert.alert('Error', response.error);
        setIsDeleting(false);
        return;
      }
      
      if (response.data?.success) {
        Alert.alert(
          'Account Deleted',
          'Your account and all associated data have been permanently deleted. You will now be logged out.',
          [
            {
              text: 'OK',
              onPress: async () => {
                await logout();
                router.replace('/(auth)/login');
              },
            },
          ]
        );
      } else {
        Alert.alert('Error', 'Failed to delete account. Please try again or contact support.');
        setIsDeleting(false);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An unexpected error occurred');
      setIsDeleting(false);
    }
  };
  
  const handleCancel = () => {
    router.back();
  };
  
  const navigateToPrivacy = () => {
    router.push('/more/privacy-policy');
  };

  return (
    <>
      <Stack.Screen 
        options={{ 
          title: 'Delete Account',
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.foreground,
        }} 
      />
      <ScrollView 
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.warningCard}>
          <View style={styles.warningIcon}>
            <Feather name="alert-triangle" size={48} color={colors.destructive} />
          </View>
          <Text style={styles.warningTitle}>Delete Your Account</Text>
          <Text style={styles.warningText}>
            This action is permanent and cannot be undone. All your data will be permanently deleted.
          </Text>
        </View>
        
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>What Will Be Deleted</Text>
          <Text style={styles.paragraph}>
            The following data will be permanently removed from our servers:
          </Text>
          <View style={styles.bulletList}>
            <BulletItem text="All jobs and job history" colors={colors} styles={styles} />
            <BulletItem text="All clients and contact information" colors={colors} styles={styles} />
            <BulletItem text="All quotes and quote history" colors={colors} styles={styles} />
            <BulletItem text="All invoices and payment records" colors={colors} styles={styles} />
            <BulletItem text="All photos and documents" colors={colors} styles={styles} />
            <BulletItem text="All time entries and timesheets" colors={colors} styles={styles} />
            <BulletItem text="All expense records" colors={colors} styles={styles} />
            <BulletItem text="All team member associations" colors={colors} styles={styles} />
            <BulletItem text="All automations and settings" colors={colors} styles={styles} />
            <BulletItem text="Your business profile and branding" colors={colors} styles={styles} />
          </View>
        </View>
        
        <View style={styles.highlightBox}>
          <Text style={styles.highlightText}>
            Australian businesses may need to retain certain financial records for 5-7 years for tax purposes. Please ensure you have exported any necessary records before deleting your account.
          </Text>
        </View>
        
        <View style={styles.confirmationSection}>
          <Text style={styles.sectionTitle}>Confirm Deletion</Text>
          <Text style={styles.paragraph}>
            To confirm that you want to delete your account, please type "DELETE" in the field below:
          </Text>
          
          <Text style={styles.inputLabel}>Type DELETE to confirm</Text>
          <TextInput
            style={styles.textInput}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder="Type DELETE here"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="characters"
            autoCorrect={false}
            editable={!isDeleting}
            testID="input-confirm-delete"
          />
          
          <PressableRow style={[ styles.deleteButton, (!isConfirmed || isDeleting) && styles.deleteButtonDisabled ]} onPress={handleDeleteAccount} disabled={!isConfirmed || isDeleting} testID="button-delete-account" >
            {isDeleting ? (
              <ActivityIndicator color={colors.white} size="small" />
            ) : (
              <Text style={[
                styles.deleteButtonText,
                !isConfirmed && styles.deleteButtonTextDisabled
              ]}>
                Delete My Account Permanently
              </Text>
            )}
          </PressableRow>
          
          <PressableRow style={styles.cancelButton} onPress={handleCancel} disabled={isDeleting} testID="button-cancel-delete" >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </PressableRow>
        </View>
        
        <Text style={styles.legalNote}>
          By deleting your account, you acknowledge that this action is irreversible. 
          For more information about how we handle your data, please review our{' '}
          <Text style={styles.privacyLink} onPress={navigateToPrivacy}>Privacy Policy</Text>
          {' '}and{' '}
          <Text
            style={styles.privacyLink}
            onPress={() => router.push('/more/terms-of-service')}
            testID="link-terms"
          >Terms of Service</Text>.
        </Text>
      </ScrollView>
    </>
  );
}
