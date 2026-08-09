import { View, Text, TouchableOpacity, TextInput, Image } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemeColors } from '../../lib/theme';
import { SignaturePad } from '../SignaturePad';
import { spacing } from '../../lib/design-tokens';
import { showToast } from '../../lib/toast';

interface DigitalSignature {
  id: string;
  signerName: string;
  signerEmail?: string;
  signatureData: string;
  signedAt: string;
  documentType: string;
  signerRole?: 'client' | 'worker' | 'owner';
}

interface Client {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

export interface SignatureSectionProps {
  jobStatus: string;
  colors: ThemeColors;
  styles: any;
  showSignaturePad: boolean;
  setShowSignaturePad: (value: boolean) => void;
  signerName: string;
  setSignerName: (value: string) => void;
  signerRole: 'client' | 'worker' | 'owner';
  setSignerRole: (value: 'client' | 'worker' | 'owner') => void;
  saveToClient: boolean;
  setSaveToClient: (value: boolean) => void;
  client: Client | null;
  clientSavedSignature: { signatureData: string; signerName: string } | null;
  signatures: DigitalSignature[];
  handleSaveSignature: (data: { signerName: string; signerEmail?: string; signatureData: string }) => void;
  deleteSignatureDirectly: (signatureId: string) => Promise<boolean>;
  handleDeleteSignature: (signatureId: string) => void;
  confirm: (opts: { title: string; message?: string; confirmText?: string }) => Promise<boolean>;
}

export function SignatureSection(props: SignatureSectionProps) {
  const {
    jobStatus,
    colors,
    styles,
    showSignaturePad,
    setShowSignaturePad,
    signerName,
    setSignerName,
    signerRole,
    setSignerRole,
    saveToClient,
    setSaveToClient,
    client,
    clientSavedSignature,
    signatures,
    handleSaveSignature,
    deleteSignatureDirectly,
    handleDeleteSignature,
    confirm,
  } = props;

  if (!(jobStatus === 'in_progress' || jobStatus === 'done' || jobStatus === 'invoiced')) {
    return null;
  }

  return (
    <View style={styles.photosCard}>
      <View style={styles.photosHeader}>
        <View style={[styles.photosIconContainer, { backgroundColor: `${colors.primary}15` }]}>
          <Feather name="edit-3" size={20} color={colors.primary} />
        </View>
        <Text style={styles.photosHeaderLabel}>Signatures</Text>
      </View>

      {showSignaturePad ? (
        <View style={{ gap: spacing.md }}>
          {/* Role Selector - Segmented Buttons */}
          <View>
            <Text style={{ color: colors.mutedForeground, fontSize: 13, fontWeight: '600', marginBottom: spacing.sm }}>
              Signer Role
            </Text>
            <View style={{ flexDirection: 'row', gap: spacing.xs }}>
              {(['client', 'worker', 'owner'] as const).map((role) => (
                <TouchableOpacity
                  key={role}
                  style={{
                    flex: 1,
                    paddingVertical: spacing.sm,
                    paddingHorizontal: spacing.md,
                    borderRadius: 8,
                    backgroundColor: signerRole === role ? colors.primary : colors.muted,
                    borderWidth: 1,
                    borderColor: signerRole === role ? colors.primary : colors.border,
                    alignItems: 'center',
                    minHeight: 44,
                    justifyContent: 'center',
                  }}
                  onPress={() => setSignerRole(role)}
                  activeOpacity={0.7}
                  data-testid={`button-role-${role}`}
                >
                  <Text style={{
                    color: signerRole === role ? colors.primaryForeground : colors.foreground,
                    fontWeight: '600',
                    fontSize: 14,
                    textTransform: 'capitalize',
                  }}>
                    {role}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Use Saved Signature Button - Only show when role is client and client has saved signature */}
          {signerRole === 'client' && clientSavedSignature && (
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: spacing.sm,
                backgroundColor: colors.success + '15',
                paddingVertical: spacing.md,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: colors.success + '30',
                minHeight: 44,
              }}
              onPress={() => {
                if (clientSavedSignature) {
                  handleSaveSignature({
                    signerName: clientSavedSignature.signerName || client?.name || 'Client',
                    signatureData: clientSavedSignature.signatureData,
                  });
                  setSignerName('');
                }
              }}
              activeOpacity={0.7}
              data-testid="button-use-saved-signature"
            >
              <Feather name="check-circle" size={18} color={colors.success} />
              <Text style={{ color: colors.success, fontWeight: '600', fontSize: 14 }}>
                Use Saved Signature
              </Text>
            </TouchableOpacity>
          )}

          <TextInput
            style={{
              backgroundColor: colors.background,
              borderRadius: 8,
              padding: spacing.md,
              fontSize: 16,
              color: colors.foreground,
              borderWidth: 1,
              borderColor: colors.border,
              minHeight: 44,
            }}
            placeholder={`${signerRole.charAt(0).toUpperCase() + signerRole.slice(1)}'s name *`}
            placeholderTextColor={colors.mutedForeground}
            value={signerName}
            onChangeText={setSignerName}
            data-testid="input-signer-name"
          />

          <SignaturePad
            onSave={(signatureData) => {
              if (!signerName.trim()) {
                showToast({ type: 'error', message: `Please enter the ${signerRole}'s name` });
                return;
              }
              handleSaveSignature({
                signerName: signerName.trim(),
                signatureData,
              });
              setSignerName('');
            }}
            onClear={() => {}}
            showControls={true}
          />

          {/* Save to Client Checkbox - Only show when role is client */}
          {signerRole === 'client' && client?.id && (
            <TouchableOpacity
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: spacing.sm,
                paddingVertical: spacing.sm,
              }}
              onPress={() => setSaveToClient(!saveToClient)}
              activeOpacity={0.7}
              data-testid="checkbox-save-to-client"
            >
              <View style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                borderWidth: 2,
                borderColor: saveToClient ? colors.primary : colors.border,
                backgroundColor: saveToClient ? colors.primary : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {saveToClient && (
                  <Feather name="check" size={14} color={colors.primaryForeground} />
                )}
              </View>
              <Text style={{ color: colors.foreground, fontSize: 14, flex: 1 }}>
                Save signature to client profile for future use
              </Text>
            </TouchableOpacity>
          )}

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <TouchableOpacity
              style={[styles.takePhotoInlineButton, { flex: 1, backgroundColor: colors.muted, minHeight: 44 }]}
              onPress={() => {
                setShowSignaturePad(false);
                setSignerName('');
                setSignerRole('client');
                setSaveToClient(true);
              }}
              activeOpacity={0.7}
              data-testid="button-cancel-signature"
            >
              <Text style={[styles.takePhotoInlineText, { color: colors.foreground }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : signatures.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          {signatures.filter(s => s.documentType === 'job_completion').map((sig) => (
            <View key={sig.id} style={{
              backgroundColor: colors.background,
              borderRadius: 8,
              padding: spacing.md,
              borderWidth: 1,
              borderColor: colors.border,
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                    <Text style={{ color: colors.foreground, fontWeight: '600' }}>
                      Signed by {sig.signerName}
                    </Text>
                    {/* Role Badge */}
                    <View style={{
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 2,
                      borderRadius: 4,
                      backgroundColor: sig.signerRole === 'client'
                        ? colors.primary + '20'
                        : sig.signerRole === 'worker'
                          ? colors.warning + '20'
                          : colors.success + '20',
                    }}>
                      <Text style={{
                        fontSize: 11,
                        fontWeight: '600',
                        textTransform: 'capitalize',
                        color: sig.signerRole === 'client'
                          ? colors.primary
                          : sig.signerRole === 'worker'
                            ? colors.warning
                            : colors.success,
                      }}>
                        {sig.signerRole || 'Client'}
                      </Text>
                    </View>
                  </View>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 2 }}>
                    {new Date(sig.signedAt).toLocaleDateString('en-AU', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
                <View style={{ flexDirection: 'row', gap: spacing.xs }}>
                  <TouchableOpacity
                    onPress={() => {
                      confirm({
                        title: 'Re-sign?',
                        message: 'Delete this signature and capture a new one?',
                        confirmText: 'Re-sign',
                      }).then(async (ok) => {
                        if (!ok) return;
                        const deleted = await deleteSignatureDirectly(sig.id);
                        if (deleted) {
                          setShowSignaturePad(true);
                        }
                      });
                    }}
                    style={{ padding: spacing.xs }}
                    data-testid={`button-resign-${sig.id}`}
                  >
                    <Feather name="edit-2" size={18} color={colors.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteSignature(sig.id)}
                    style={{ padding: spacing.xs }}
                    data-testid={`button-delete-signature-${sig.id}`}
                  >
                    <Feather name="trash-2" size={18} color={colors.destructive} />
                  </TouchableOpacity>
                </View>
              </View>
              {/* Signature Preview */}
              <View style={{
                marginTop: spacing.sm,
                backgroundColor: colors.card,
                borderRadius: 8,
                padding: spacing.sm,
                alignItems: 'center',
              }}>
                {sig.signatureData ? (
                  <Image
                    source={{ uri: sig.signatureData }}
                    style={{
                      width: '100%',
                      height: 120,
                      borderRadius: 4,
                    }}
                    resizeMode="contain"
                  />
                ) : (
                  <>
                    <Feather name="check-circle" size={24} color={colors.success} />
                    <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>
                      Signature captured
                    </Text>
                  </>
                )}
              </View>
            </View>
          ))}
          {/* Add Another Signature Button */}
          <TouchableOpacity
            style={[styles.takePhotoInlineButton, { marginTop: spacing.xs }]}
            onPress={() => setShowSignaturePad(true)}
            activeOpacity={0.7}
            data-testid="button-add-another-signature"
          >
            <Feather name="plus" size={18} color={colors.foreground} />
            <Text style={styles.takePhotoInlineText}>Add Another Signature</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: `${colors.primary}10`, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.md }}>
            <Feather name="edit-3" size={28} color={colors.mutedForeground} />
          </View>
          <Text style={{ fontSize: 15, color: colors.mutedForeground, textAlign: 'center', marginBottom: spacing.xs }}>
            No signatures yet
          </Text>
          <Text style={{ fontSize: 13, color: colors.mutedForeground, textAlign: 'center', marginBottom: spacing.lg, paddingHorizontal: spacing.md }}>
            Capture client or worker signatures for job sign-off
          </Text>
          <TouchableOpacity
            style={[styles.takePhotoInlineButton, { width: '100%' }]}
            onPress={() => setShowSignaturePad(true)}
            activeOpacity={0.7}
            data-testid="button-capture-signature"
          >
            <Feather name="edit-3" size={18} color={colors.foreground} />
            <Text style={styles.takePhotoInlineText}>Capture Signature</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}
