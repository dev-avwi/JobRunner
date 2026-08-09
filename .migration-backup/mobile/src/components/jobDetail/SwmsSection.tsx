import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ThemeColors } from '../../lib/theme';
import { spacing, radius, iconSizes } from '../../lib/design-tokens';

interface SwmsHazard {
  id: string;
  hazardDescription: string;
  riskConsequence?: string;
  riskLikelihood?: string;
  riskRating?: string;
  controlMeasures?: string;
  responsiblePerson?: string;
}

interface SwmsSignature {
  id: string;
  workerName: string;
  signedAt?: string;
  address?: string;
}

interface SwmsDocument {
  id: string;
  title: string;
  description?: string;
  jobId?: string;
  siteAddress?: string;
  workActivityDescription?: string;
  ppeRequirements?: string[];
  emergencyContact?: string;
  firstAidLocation?: string;
  status?: string;
  createdAt?: string;
  hazardCount?: number;
  signatureCount?: number;
  hazards?: SwmsHazard[];
  signatures?: SwmsSignature[];
}

export interface SwmsSectionProps {
  colors: ThemeColors;
  styles: any;
  swmsDocuments: SwmsDocument[];
  isLoadingSwms: boolean;
  expandedSwmsId: string | null;
  toggleSwmsExpand: (swmsId: string) => void;
  handleStartCreateSwms: () => void;
  handleDownloadSwmsPdf: (swmsId: string) => void;
  getStatusColor: (status?: string) => string;
  getRiskColor: (rating?: string) => string;
  setSigningSwmsId: (id: string | null) => void;
  setSignWorkerName: (value: string) => void;
  setShowSignSwmsModal: (value: boolean) => void;
}

export function SwmsSection(props: SwmsSectionProps) {
  const {
    colors,
    styles,
    swmsDocuments,
    isLoadingSwms,
    expandedSwmsId,
    toggleSwmsExpand,
    handleStartCreateSwms,
    handleDownloadSwmsPdf,
    getStatusColor,
    getRiskColor,
    setSigningSwmsId,
    setSignWorkerName,
    setShowSignSwmsModal,
  } = props;

  return (
    <>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={[styles.cardIconContainer, { backgroundColor: `${colors.primary}15`, marginRight: spacing.sm }]}>
            <Feather name="shield" size={iconSizes.lg} color={colors.primary} />
          </View>
          <View>
            <Text style={{ fontSize: 16, fontWeight: '600', color: colors.foreground }}>SWMS Documents</Text>
            <Text style={{ fontSize: 13, color: colors.mutedForeground }}>
              {swmsDocuments.length} document{swmsDocuments.length !== 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        <TouchableOpacity
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: `${colors.primary}12`,
            borderWidth: 1,
            borderColor: `${colors.primary}25`,
            paddingHorizontal: spacing.md,
            paddingVertical: spacing.sm,
            borderRadius: radius.lg,
            gap: spacing.xs,
          }}
          onPress={handleStartCreateSwms}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={16} color={colors.primary} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Create SWMS</Text>
        </TouchableOpacity>
      </View>

      {isLoadingSwms ? (
        <View style={{ alignItems: 'center', paddingVertical: spacing.xl }}>
          <ActivityIndicator color={colors.primary} />
          <Text style={{ fontSize: 14, color: colors.mutedForeground, marginTop: spacing.sm }}>Loading safety documents...</Text>
        </View>
      ) : swmsDocuments.length === 0 ? (
        <View style={{ paddingVertical: spacing.sm }}>
          <Text style={{ fontSize: 14, color: colors.mutedForeground, textAlign: 'center' }}>
            No documents yet. Tap Create SWMS above to get started.
          </Text>
        </View>
      ) : (
        swmsDocuments.map((swms) => {
          const isExpanded = expandedSwmsId === swms.id;
          return (
            <View key={swms.id} style={[styles.notesCard, { marginBottom: spacing.md }]}>
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center' }}
                onPress={() => toggleSwmsExpand(swms.id)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs }}>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: colors.foreground, flex: 1 }} numberOfLines={1}>
                      {swms.title}
                    </Text>
                    <View style={{
                      paddingHorizontal: spacing.sm,
                      paddingVertical: 2,
                      borderRadius: radius.sm,
                      backgroundColor: `${getStatusColor(swms.status)}20`,
                    }}>
                      <Text style={{ fontSize: 11, fontWeight: '600', color: getStatusColor(swms.status), textTransform: 'capitalize' }}>
                        {swms.status || 'draft'}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Feather name="alert-triangle" size={12} color={colors.mutedForeground} />
                      <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                        {swms.hazardCount || 0} hazard{(swms.hazardCount || 0) !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                      <Feather name="edit-3" size={12} color={colors.mutedForeground} />
                      <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                        {swms.signatureCount || 0} signature{(swms.signatureCount || 0) !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    {swms.createdAt && (
                      <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                        {new Date(swms.createdAt).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                </View>
                <Feather name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={colors.mutedForeground} style={{ marginLeft: spacing.sm }} />
              </TouchableOpacity>

              {isExpanded && (
                <View style={{ marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border }}>
                  {swms.hazards && swms.hazards.length > 0 && (
                    <View style={{ marginBottom: spacing.md }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: spacing.sm }}>
                        Hazards
                      </Text>
                      {swms.hazards.map((hazard, idx) => (
                        <View key={hazard.id || idx} style={{
                          backgroundColor: colors.muted,
                          borderRadius: radius.md,
                          paddingHorizontal: spacing.sm,
                          paddingVertical: spacing.sm,
                          marginBottom: spacing.xs,
                        }}>
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                            <View style={{
                              width: 22,
                              height: 22,
                              borderRadius: 11,
                              backgroundColor: `${getRiskColor(hazard.riskRating)}20`,
                              alignItems: 'center',
                              justifyContent: 'center',
                              marginTop: 1,
                            }}>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: getRiskColor(hazard.riskRating) }}>
                                {idx + 1}
                              </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground, marginBottom: 2 }} numberOfLines={3}>
                                {hazard.hazardDescription}
                              </Text>
                              {hazard.controlMeasures && (
                                <Text style={{ fontSize: 12, color: colors.mutedForeground, lineHeight: 17 }} numberOfLines={3}>
                                  {hazard.controlMeasures}
                                </Text>
                              )}
                            </View>
                            {hazard.riskRating && (
                              <View style={{
                                paddingHorizontal: 6,
                                paddingVertical: 2,
                                borderRadius: radius.sm,
                                backgroundColor: `${getRiskColor(hazard.riskRating)}15`,
                              }}>
                                <Text style={{ fontSize: 9, fontWeight: '700', color: getRiskColor(hazard.riskRating), textTransform: 'uppercase' }}>
                                  {hazard.riskRating}
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {swms.signatures && swms.signatures.length > 0 && (
                    <View style={{ marginBottom: spacing.md }}>
                      <Text style={{ fontSize: 13, fontWeight: '700', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.3, marginBottom: spacing.sm }}>
                        Signatures
                      </Text>
                      {swms.signatures.map((sig, idx) => (
                        <View key={sig.id || idx} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.xs, gap: spacing.sm }}>
                          <Feather name="check-circle" size={14} color={colors.success} />
                          <Text style={{ fontSize: 14, color: colors.foreground, flex: 1 }}>{sig.workerName}</Text>
                          {sig.signedAt && (
                            <Text style={{ fontSize: 12, color: colors.mutedForeground }}>
                              {new Date(sig.signedAt).toLocaleDateString()}
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>
                  )}

                  {swms.signatures && swms.signatures.length > 0 && (
                    <View style={{
                      backgroundColor: `${colors.success}10`,
                      borderWidth: 1,
                      borderColor: `${colors.success}30`,
                      borderRadius: radius.lg,
                      padding: spacing.md,
                      marginBottom: spacing.sm,
                    }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.sm }}>
                        <Feather name="shield" size={16} color={colors.success} />
                        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.success }}>
                          SWMS Signed
                        </Text>
                        <View style={{ flex: 1 }} />
                        <Text style={{ fontSize: 12, color: colors.success, fontWeight: '600' }}>
                          {swms.signatures.length} worker{swms.signatures.length !== 1 ? 's' : ''}
                        </Text>
                      </View>
                      <Text style={{ fontSize: 12, color: colors.mutedForeground, marginBottom: spacing.sm }}>
                        This SWMS has been signed and is on record. You can view the PDF or add another worker's signature below.
                      </Text>
                      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                        <TouchableOpacity
                          style={{
                            flex: 1,
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: colors.muted,
                            paddingVertical: spacing.sm,
                            borderRadius: radius.lg,
                            borderWidth: 1,
                            borderColor: colors.border,
                            gap: spacing.xs,
                          }}
                          onPress={() => {
                            setSigningSwmsId(swms.id);
                            setSignWorkerName('');
                            setShowSignSwmsModal(true);
                          }}
                          activeOpacity={0.7}
                        >
                          <Feather name="user-plus" size={14} color={colors.foreground} />
                          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>Add Worker</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}

                  {(!swms.signatures || swms.signatures.length === 0) && (swms.signatureCount ?? 0) === 0 && (
                  <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: `${colors.primary}12`,
                        borderWidth: 1,
                        borderColor: `${colors.primary}25`,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.lg,
                        gap: spacing.xs,
                        minHeight: 40,
                      }}
                      onPress={() => {
                        setSigningSwmsId(swms.id);
                        setSignWorkerName('');
                        setShowSignSwmsModal(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Feather name="edit-3" size={14} color={colors.primary} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.primary }}>
                        Sign SWMS
                      </Text>
                    </TouchableOpacity>
                  </View>
                  )}

                  <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: colors.muted,
                        paddingVertical: spacing.sm,
                        borderRadius: radius.md,
                        borderWidth: 1,
                        borderColor: colors.border,
                        gap: spacing.xs,
                        minHeight: 36,
                      }}
                      onPress={() => handleDownloadSwmsPdf(swms.id)}
                      activeOpacity={0.7}
                    >
                      <Feather name="download" size={14} color={colors.foreground} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: colors.foreground }}>PDF</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })
      )}
    </>
  );
}
