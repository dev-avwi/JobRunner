/**
 * PendingProjectUploadsBanner - shows when a job has project documents that
 * were selected during creation but failed to upload. Lets the user retry or
 * discard them, and cleans itself up once all uploads succeed.
 */
import { useEffect, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Alert } from '@/lib/alert';
import { useTheme, ThemeColors, colorWithOpacity } from '../../lib/theme';
import { spacing, radius, typography, fontWeights } from '../../lib/design-tokens';
import { showToast } from '../../lib/toast';
import {
  getPendingUploads,
  retryPendingUploads,
  discardPendingUploads,
  type PendingProjectUpload,
} from '../../lib/pending-project-uploads';

interface Props {
  jobId: string;
  creationRequestId?: string | null;
  /** Called after uploads succeed so the parent can refresh the document list. */
  onUploaded?: () => void;
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      marginBottom: spacing.md,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colorWithOpacity(colors.warning, 0.4),
      padding: spacing.sm + 2,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    iconWrap: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: colorWithOpacity(colors.warning, 0.12),
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.bold,
      color: colors.foreground,
      marginBottom: 1,
    },
    subtitle: {
      fontSize: typography.captionSmall.fontSize,
      color: colors.mutedForeground,
      lineHeight: 16,
    },
    actionsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.sm + 2,
    },
    retryButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      backgroundColor: colors.primary,
      borderRadius: radius.md,
      paddingVertical: spacing.sm + 2,
      minHeight: 44,
    },
    retryText: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.semibold,
      color: colors.primaryForeground,
    },
    discardButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.xs,
      borderWidth: 1,
      borderColor: colors.buttonOutline,
      borderRadius: radius.md,
      paddingVertical: spacing.sm + 2,
      paddingHorizontal: spacing.md,
      minHeight: 44,
    },
    discardText: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.semibold,
      color: colors.destructive,
    },
  });
}

export function PendingProjectUploadsBanner({ jobId, creationRequestId, onUploaded }: Props) {
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const [pending, setPending] = useState<PendingProjectUpload[]>([]);
  const [isBusy, setIsBusy] = useState(false);

  const load = useCallback(async () => {
    const docs = await getPendingUploads(jobId, creationRequestId);
    setPending(docs);
  }, [creationRequestId, jobId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRetry = useCallback(async () => {
    if (isBusy) return;
    setIsBusy(true);
    try {
      const stillFailed = await retryPendingUploads(jobId);
      setPending(stillFailed);
      if (stillFailed.length === 0) {
        showToast({ type: 'success', message: 'Uploads complete', description: 'All documents are now attached.' });
        onUploaded?.();
      } else {
        showToast({
          type: 'error',
          message: 'Some uploads failed',
          description: `${stillFailed.length} document${stillFailed.length !== 1 ? 's' : ''} still need to be retried.`,
        });
      }
    } finally {
      setIsBusy(false);
    }
  }, [isBusy, jobId, onUploaded]);

  const handleDiscard = useCallback(() => {
    if (isBusy) return;
    Alert.alert(
      'Discard Pending Uploads',
      `Remove ${pending.length} document${pending.length !== 1 ? 's' : ''} that failed to upload? The saved copies will be deleted and cannot be recovered.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: async () => {
            setIsBusy(true);
            try {
              await discardPendingUploads(jobId);
              setPending([]);
              showToast({ type: 'info', message: 'Pending uploads discarded' });
            } finally {
              setIsBusy(false);
            }
          },
        },
      ],
    );
  }, [isBusy, jobId, pending.length]);

  if (pending.length === 0) return null;

  const count = pending.length;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Feather name="upload-cloud" size={16} color={colors.warning} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>
            {count} document{count !== 1 ? 's' : ''} waiting to upload
          </Text>
          <Text style={styles.subtitle}>
            These files were selected when the project was created but did not finish uploading.
          </Text>
        </View>
      </View>
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleRetry}
          disabled={isBusy}
          testID="pending-uploads-retry"
        >
          {isBusy ? (
            <ActivityIndicator size="small" color={colors.primaryForeground} />
          ) : (
            <>
              <Feather name="refresh-cw" size={16} color={colors.primaryForeground} />
              <Text style={styles.retryText}>Retry Uploads</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.discardButton}
          onPress={handleDiscard}
          disabled={isBusy}
          testID="pending-uploads-discard"
        >
          <Feather name="trash-2" size={16} color={colors.destructive} />
          <Text style={styles.discardText}>Discard</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}
