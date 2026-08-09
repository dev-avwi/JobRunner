import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { useConfirmDialog } from '../../src/components/ui/ConfirmDialog';
import { AppBottomSheet } from '../../src/components/ui/AppBottomSheet';
import { api } from '../../src/lib/api';
import { TeamAvatar } from '../../src/components/TeamAvatar';
import { spacing, radius, shadows, typography, pageShell, iconSizes, sizes, fontWeights } from '../../src/lib/design-tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';

interface TeamMember {
  id: number;
  name: string;
  email?: string;
  profilePhoto?: string | null;
  role?: string;
}

interface TeamGroup {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  memberCount: number;
}

interface TeamGroupMember {
  id: string;
  teamMemberId: string;
  role?: string | null;
  member?: TeamMember;
}

interface TeamGroupWithMembers {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  members: TeamGroupMember[];
}

const colorOptions = [
  { value: '#3b82f6', label: 'Blue' },
  { value: '#22c55e', label: 'Green' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#ef4444', label: 'Red' },
  { value: '#8b5cf6', label: 'Purple' },
  { value: '#ec4899', label: 'Pink' },
  { value: '#06b6d4', label: 'Cyan' },
  { value: '#64748b', label: 'Slate' },
];

const getInitials = (name: string) => {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

function createStyles(colors: ThemeColors, bottomNavHeight: number = 0) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollContent: {
      paddingHorizontal: pageShell.paddingHorizontal,
      paddingTop: pageShell.paddingTop,
      paddingBottom: bottomNavHeight,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: radius.xl,
      padding: spacing.lg,
      marginBottom: spacing.sm,
      borderWidth: 1,
      borderColor: colors.border,
      ...shadows.xs,
    },
    cardTopRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    cardLeftContent: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    colorDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
    },
    cardTitleArea: {
      flex: 1,
    },
    cardTitle: {
      ...typography.bodySemibold,
      color: colors.foreground,
    },
    cardDescription: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    memberBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      backgroundColor: colors.muted,
      marginTop: spacing.md,
      alignSelf: 'flex-start',
    },
    memberBadgeText: {
      ...typography.badge,
      color: colors.mutedForeground,
    },
    menuButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyState: {
      alignItems: 'center',
      paddingVertical: spacing['3xl'],
      paddingHorizontal: spacing.xl,
    },
    emptyIcon: {
      width: sizes.emptyIcon,
      height: sizes.emptyIcon,
      borderRadius: sizes.emptyIcon / 2,
      backgroundColor: colors.muted,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: spacing.lg,
    },
    emptyTitle: {
      ...typography.cardTitle,
      color: colors.foreground,
      marginBottom: spacing.sm,
    },
    emptySubtitle: {
      ...typography.caption,
      color: colors.mutedForeground,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: spacing.lg,
    },
    emptyButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
    },
    emptyButtonText: {
      ...typography.button,
      color: colors.primaryForeground,
    },
    loadingContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing['4xl'],
    },
    loadingText: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: spacing.sm,
    },
    fab: {
      position: 'absolute',
      bottom: spacing.xl,
      right: spacing.xl,
      width: sizes.fabSize,
      height: sizes.fabSize,
      borderRadius: sizes.fabSize / 2,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      ...shadows.md,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.card,
      borderTopLeftRadius: radius['2xl'],
      borderTopRightRadius: radius['2xl'],
      paddingTop: spacing.lg,
      paddingBottom: Platform.OS === 'ios' ? 40 : spacing.xl,
      maxHeight: '85%',
    },
    modalHandle: {
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: spacing.md,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      marginBottom: spacing.lg,
      gap: spacing.sm,
    },
    modalTitle: {
      ...typography.cardTitle,
      color: colors.foreground,
      flex: 1,
    },
    modalBody: {
      paddingHorizontal: spacing.lg,
    },
    modalLabel: {
      ...typography.caption,
      fontWeight: fontWeights.semibold,
      color: colors.mutedForeground,
      marginBottom: spacing.sm,
      marginTop: spacing.md,
    },
    modalInput: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      ...typography.body,
      color: colors.foreground,
    },
    modalTextArea: {
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.md,
      ...typography.body,
      color: colors.foreground,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    colorPickerRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    colorButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    colorButtonSelected: {
      borderWidth: 2,
      borderColor: colors.primary,
    },
    colorButtonInner: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: '#ffffff',
    },
    modalSaveButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.primary,
      marginTop: spacing.xl,
    },
    modalSaveButtonText: {
      ...typography.button,
      color: colors.primaryForeground,
    },
    modalCancelButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.muted,
      marginTop: spacing.sm,
    },
    modalCancelButtonText: {
      ...typography.button,
      color: colors.foreground,
    },
    memberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.muted,
      marginBottom: spacing.xs,
    },
    avatar: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      ...typography.badge,
      color: colors.primaryForeground,
    },
    memberInfo: {
      flex: 1,
    },
    memberName: {
      ...typography.bodySemibold,
      color: colors.foreground,
      fontSize: typography.button.fontSize,
    },
    memberEmail: {
      ...typography.caption,
      color: colors.mutedForeground,
      fontSize: typography.captionSmall.fontSize,
    },
    memberRoleBadge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: 2,
      borderRadius: radius.sm,
      backgroundColor: colors.primaryLight,
    },
    memberRoleBadgeText: {
      ...typography.badge,
      color: colors.primary,
    },
    removeButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addMemberRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      marginBottom: spacing.xs,
    },
    addButton: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionTitle: {
      ...typography.caption,
      fontWeight: fontWeights.semibold,
      color: colors.mutedForeground,
      marginBottom: spacing.sm,
      marginTop: spacing.lg,
    },
    emptyMembersText: {
      ...typography.caption,
      color: colors.mutedForeground,
      textAlign: 'center',
      paddingVertical: spacing.lg,
    },
    actionSheetItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
    },
    actionSheetText: {
      ...typography.body,
      color: colors.foreground,
    },
    actionSheetDestructive: {
      color: colors.destructive,
    },
    actionSheetDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginHorizontal: spacing.lg,
    },
    doneButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
      borderRadius: radius.md,
      backgroundColor: colors.muted,
      marginTop: spacing.lg,
    },
    doneButtonText: {
      ...typography.button,
      color: colors.foreground,
    },
    viewHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      marginBottom: spacing.sm,
    },
    viewColorDot: {
      width: 16,
      height: 16,
      borderRadius: 8,
    },
    viewDescription: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginBottom: spacing.lg,
    },
    manageMembersButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.md,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    manageMembersText: {
      ...typography.caption,
      fontWeight: fontWeights.semibold,
      color: colors.foreground,
    },
    membersHeaderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: spacing.sm,
      gap: spacing.sm,
    },
  });
}

export default function TeamGroupsScreen() {
  const { colors } = useTheme();
  const confirm = useConfirmDialog();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);

  const [groups, setGroups] = useState<TeamGroup[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [formModalVisible, setFormModalVisible] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TeamGroup | null>(null);
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formColor, setFormColor] = useState('#3b82f6');
  const [formSaving, setFormSaving] = useState(false);

  const [viewingGroup, setViewingGroup] = useState<TeamGroupWithMembers | null>(null);
  const [viewModalVisible, setViewModalVisible] = useState(false);

  const [manageMembersVisible, setManageMembersVisible] = useState(false);

  const [actionSheetGroup, setActionSheetGroup] = useState<TeamGroup | null>(null);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await api.get<TeamGroup[]>('/api/team-groups');
      if (!res.error) {
        setGroups(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error('Failed to fetch groups:', err);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchTeamMembers = useCallback(async () => {
    try {
      const res = await api.get<TeamMember[]>('/api/team/members');
      if (!res.error) {
        setTeamMembers(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error('Failed to fetch team members:', err);
    }
  }, []);

  const fetchGroupDetails = useCallback(async (groupId: string) => {
    try {
      const res = await api.get<TeamGroupWithMembers>(`/api/team-groups/${groupId}`);
      if (!res.error && res.data) {
        setViewingGroup(res.data);
      }
    } catch (err) {
      console.error('Failed to fetch group details:', err);
    }
  }, []);

  useEffect(() => {
    fetchGroups();
    fetchTeamMembers();
  }, [fetchGroups, fetchTeamMembers]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchGroups();
    fetchTeamMembers();
  }, [fetchGroups, fetchTeamMembers]);

  const resetForm = () => {
    setFormName('');
    setFormDescription('');
    setFormColor('#3b82f6');
    setEditingGroup(null);
  };

  const openCreateModal = () => {
    resetForm();
    setFormModalVisible(true);
  };

  const openEditModal = (group: TeamGroup) => {
    setFormName(group.name);
    setFormDescription(group.description || '');
    setFormColor(group.color || '#3b82f6');
    setEditingGroup(group);
    setFormModalVisible(true);
    setActionSheetGroup(null);
  };

  const handleSave = async () => {
    if (!formName.trim()) return;
    setFormSaving(true);
    try {
      const body = { name: formName.trim(), description: formDescription.trim(), color: formColor };
      if (editingGroup) {
        const res = await api.patch(`/api/team-groups/${editingGroup.id}`, body);
        if (res.error) {
          Alert.alert('Error', 'Failed to update group');
          return;
        }
      } else {
        const res = await api.post('/api/team-groups', body);
        if (res.error) {
          Alert.alert('Error', 'Failed to create group');
          return;
        }
      }
      setFormModalVisible(false);
      resetForm();
      fetchGroups();
    } catch (err) {
      Alert.alert('Error', 'Something went wrong');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async (group: TeamGroup) => {
    setActionSheetGroup(null);
    const ok = await confirm({
      title: 'Delete Group',
      message: `Are you sure you want to delete "${group.name}"? This cannot be undone.`,
      confirmText: 'Delete',
      cancelText: 'Cancel',
      destructive: true,
    });
    if (ok) {
      try {
        const res = await api.delete(`/api/team-groups/${group.id}`);
        if (res.error) {
          Alert.alert('Error', 'Failed to delete group');
        } else {
          fetchGroups();
        }
      } catch (err) {
        Alert.alert('Error', 'Something went wrong');
      }
    }
  };

  const handleViewGroup = (group: TeamGroup) => {
    fetchGroupDetails(group.id);
    setViewModalVisible(true);
    setManageMembersVisible(false);
  };

  const handleManageMembers = (group: TeamGroup) => {
    fetchGroupDetails(group.id);
    setManageMembersVisible(true);
    setViewModalVisible(true);
    setActionSheetGroup(null);
  };

  const handleAddMember = async (teamMemberId: number) => {
    if (!viewingGroup) return;
    try {
      const res = await api.post(`/api/team-groups/${viewingGroup.id}/members`, { teamMemberId });
      if (res.error) {
        Alert.alert('Error', 'Failed to add member');
      } else {
        fetchGroupDetails(viewingGroup.id);
        fetchGroups();
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong');
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!viewingGroup) return;
    try {
      const res = await api.delete(`/api/team-groups/${viewingGroup.id}/members/${memberId}`);
      if (res.error) {
        Alert.alert('Error', 'Failed to remove member');
      } else {
        fetchGroupDetails(viewingGroup.id);
        fetchGroups();
      }
    } catch (err) {
      Alert.alert('Error', 'Something went wrong');
    }
  };

  const availableMembers = useMemo(() => {
    if (!viewingGroup) return teamMembers;
    return teamMembers.filter(
      (tm) => !viewingGroup.members?.some((m) => String(m.teamMemberId) === String(tm.id))
    );
  }, [viewingGroup, teamMembers]);

  const renderGroupCard = (group: TeamGroup) => (
    <PressableRow key={group.id} style={styles.card} onPress={() => handleViewGroup(group)} >
      <View style={styles.cardTopRow}>
        <View style={styles.cardLeftContent}>
          <View style={[styles.colorDot, { backgroundColor: group.color || '#3b82f6' }]} />
          <View style={styles.cardTitleArea}>
            <Text style={styles.cardTitle} numberOfLines={1}>{group.name}</Text>
            {group.description ? (
              <Text style={styles.cardDescription} numberOfLines={2}>{group.description}</Text>
            ) : null}
          </View>
        </View>
        <PressableRow style={styles.menuButton} onPress={() => setActionSheetGroup(group)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} >
          <Feather name="more-vertical" size={iconSizes.lg} color={colors.mutedForeground} />
        </PressableRow>
      </View>
      <View style={styles.memberBadge}>
        <Feather name="users" size={iconSizes.xs} color={colors.mutedForeground} />
        <Text style={styles.memberBadgeText}>
          {group.memberCount} member{group.memberCount !== 1 ? 's' : ''}
        </Text>
      </View>
    </PressableRow>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'Team Groups',
          headerShown: true,
        }}
      />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading groups...</Text>
        </View>
      ) : groups.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
        >
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Feather name="users" size={iconSizes['2xl']} color={colors.mutedForeground} />
            </View>
            <Text style={styles.emptyTitle}>No team groups yet</Text>
            <Text style={styles.emptySubtitle}>
              Create your first team group to organise your crew members
            </Text>
            <PressableRow style={styles.emptyButton} onPress={openCreateModal} >
              <Feather name="plus" size={iconSizes.lg} color={colors.primaryForeground} />
              <Text style={styles.emptyButtonText}>Create Group</Text>
            </PressableRow>
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} />
          }
        >
          {groups.map(renderGroupCard)}
        </ScrollView>
      )}

      {groups.length > 0 && (
        <PressableRow style={styles.fab} onPress={openCreateModal} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Feather name="plus" size={iconSizes['2xl']} color={colors.primaryForeground} />
        </PressableRow>
      )}

      <Modal visible={actionSheetGroup !== null} transparent animationType="fade" onRequestClose={() => setActionSheetGroup(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setActionSheetGroup(null)}>
          <View style={styles.modalContent}>
            <View style={styles.modalHandle} />
            <PressableRow style={styles.actionSheetItem} onPress={() => actionSheetGroup && handleManageMembers(actionSheetGroup)}>
              <Feather name="user-plus" size={iconSizes.xl} color={colors.foreground} />
              <Text style={styles.actionSheetText}>Manage Members</Text>
            </PressableRow>
            <View style={styles.actionSheetDivider} />
            <PressableRow style={styles.actionSheetItem} onPress={() => actionSheetGroup && openEditModal(actionSheetGroup)}>
              <Feather name="edit-2" size={iconSizes.xl} color={colors.foreground} />
              <Text style={styles.actionSheetText}>Edit Group</Text>
            </PressableRow>
            <View style={styles.actionSheetDivider} />
            <PressableRow style={styles.actionSheetItem} onPress={() => actionSheetGroup && handleDelete(actionSheetGroup)}>
              <Feather name="trash-2" size={iconSizes.xl} color={colors.destructive} />
              <Text style={[styles.actionSheetText, styles.actionSheetDestructive]}>Delete Group</Text>
            </PressableRow>
          </View>
        </TouchableOpacity>
      </Modal>

      <AppBottomSheet
        visible={formModalVisible}
        onDismiss={() => { setFormModalVisible(false); resetForm(); }}
        snapPoints={['85%']}
        scrollable={false}
        contentPadding={0}>
        <View>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {editingGroup ? 'Edit Group' : 'Create New Group'}
                </Text>
                <PressableRow onPress={() => { setFormModalVisible(false); resetForm(); }}>
                  <Feather name="x" size={iconSizes['2xl']} color={colors.mutedForeground} />
                </PressableRow>
              </View>
              <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
                <Text style={[styles.modalLabel, { marginTop: 0 }]}>Group Name</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="e.g., The Plumblords"
                  placeholderTextColor={colors.mutedForeground}
                  value={formName}
                  onChangeText={setFormName}
                  autoFocus
                />

                <Text style={styles.modalLabel}>Description (optional)</Text>
                <TextInput
                  style={styles.modalTextArea}
                  placeholder="Describe this group..."
                  placeholderTextColor={colors.mutedForeground}
                  value={formDescription}
                  onChangeText={setFormDescription}
                  multiline
                  numberOfLines={3}
                />

                <Text style={styles.modalLabel}>Group Colour</Text>
                <View style={styles.colorPickerRow}>
                  {colorOptions.map((c) => (
                    <PressableRow key={c.value} style={[ styles.colorButton, { backgroundColor: c.value }, formColor === c.value && styles.colorButtonSelected, ]} onPress={() => setFormColor(c.value)} >
                      {formColor === c.value && <View style={styles.colorButtonInner} />}
                    </PressableRow>
                  ))}
                </View>

                <PressableRow style={[styles.modalSaveButton, (!formName.trim() || formSaving) && { opacity: 0.5 }]} onPress={handleSave} disabled={!formName.trim() || formSaving} >
                  {formSaving ? (
                    <ActivityIndicator size="small" color={colors.primaryForeground} />
                  ) : null}
                  <Text style={styles.modalSaveButtonText}>
                    {formSaving ? 'Saving...' : editingGroup ? 'Update Group' : 'Create Group'}
                  </Text>
                </PressableRow>

                <PressableRow style={styles.modalCancelButton} onPress={() => { setFormModalVisible(false); resetForm(); }} >
                  <Text style={styles.modalCancelButtonText}>Cancel</Text>
                </PressableRow>
              </ScrollView>
        </View>
      </AppBottomSheet>

      <AppBottomSheet
        visible={viewModalVisible && !manageMembersVisible}
        onDismiss={() => { setViewModalVisible(false); setViewingGroup(null); }}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View>
              <View style={styles.modalHeader}>
                <View style={styles.viewHeaderRow}>
                  <View style={[styles.viewColorDot, { backgroundColor: viewingGroup?.color || '#3b82f6' }]} />
                  <Text style={styles.modalTitle}>{viewingGroup?.name}</Text>
                </View>
                <PressableRow onPress={() => { setViewModalVisible(false); setViewingGroup(null); }}>
                  <Feather name="x" size={iconSizes['2xl']} color={colors.mutedForeground} />
                </PressableRow>
              </View>
              <ScrollView style={styles.modalBody}>
                {viewingGroup?.description ? (
                  <Text style={styles.viewDescription}>{viewingGroup.description}</Text>
                ) : null}

                <View style={styles.membersHeaderRow}>
                  <Text style={[styles.sectionTitle, { marginTop: 0, marginBottom: 0 }]}>Members</Text>
                  <PressableRow style={styles.manageMembersButton} onPress={() => setManageMembersVisible(true)} >
                    <Feather name="user-plus" size={iconSizes.sm} color={colors.foreground} />
                    <Text style={styles.manageMembersText}>Manage</Text>
                  </PressableRow>
                </View>

                {!viewingGroup?.members || viewingGroup.members.length === 0 ? (
                  <Text style={styles.emptyMembersText}>No members in this group yet</Text>
                ) : (
                  viewingGroup.members.map((membership) => (
                    <View key={membership.id} style={styles.memberRow}>
                      <TeamAvatar
                        name={membership.member?.name}
                        email={membership.member?.email}
                        userId={membership.member ? String(membership.member.id) : undefined}
                        profileImageUrl={membership.member?.profilePhoto}
                        size={36}
                      />
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName} numberOfLines={1}>
                          {membership.member?.name || 'Unknown'}
                        </Text>
                        {membership.member?.email ? (
                          <Text style={styles.memberEmail} numberOfLines={1}>
                            {membership.member.email}
                          </Text>
                        ) : null}
                      </View>
                      {membership.role === 'lead' && (
                        <View style={styles.memberRoleBadge}>
                          <Text style={styles.memberRoleBadgeText}>Lead</Text>
                        </View>
                      )}
                    </View>
                  ))
                )}
              </ScrollView>
        </View>
      </AppBottomSheet>

      <AppBottomSheet
        visible={manageMembersVisible && viewingGroup !== null}
        onDismiss={() => setManageMembersVisible(false)}
        snapPoints={['90%']}
        scrollable={false}
        contentPadding={0}>
        <View>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Manage Members - {viewingGroup?.name}</Text>
                <PressableRow onPress={() => setManageMembersVisible(false)}>
                  <Feather name="x" size={iconSizes['2xl']} color={colors.mutedForeground} />
                </PressableRow>
              </View>
              <ScrollView style={styles.modalBody}>
                {viewingGroup?.members && viewingGroup.members.length > 0 && (
                  <>
                    <Text style={[styles.sectionTitle, { marginTop: 0 }]}>Current Members</Text>
                    {viewingGroup.members.map((membership) => (
                      <View key={membership.id} style={styles.memberRow}>
                        <TeamAvatar
                          name={membership.member?.name}
                          email={membership.member?.email}
                          userId={membership.member ? String(membership.member.id) : undefined}
                          profileImageUrl={membership.member?.profilePhoto}
                          size={36}
                        />
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName} numberOfLines={1}>
                            {membership.member?.name || 'Unknown'}
                          </Text>
                        </View>
                        <PressableRow style={styles.removeButton} onPress={() => handleRemoveMember(membership.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} >
                          <Feather name="x" size={iconSizes.lg} color={colors.mutedForeground} />
                        </PressableRow>
                      </View>
                    ))}
                  </>
                )}

                {availableMembers.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Add Members</Text>
                    {availableMembers.map((member) => (
                      <PressableRow key={member.id} style={styles.addMemberRow} onPress={() => handleAddMember(member.id)} >
                        <TeamAvatar
                          name={member.name}
                          email={member.email}
                          userId={String(member.id)}
                          profileImageUrl={member.profilePhoto}
                          size={36}
                        />
                        <View style={styles.memberInfo}>
                          <Text style={styles.memberName} numberOfLines={1}>{member.name}</Text>
                          {member.email ? (
                            <Text style={styles.memberEmail} numberOfLines={1}>{member.email}</Text>
                          ) : null}
                        </View>
                        <View style={styles.addButton}>
                          <Feather name="plus" size={iconSizes.sm} color={colors.primary} />
                        </View>
                      </PressableRow>
                    ))}
                  </>
                )}

                {availableMembers.length === 0 && teamMembers.length > 0 && (
                  <Text style={styles.emptyMembersText}>
                    All team members have been added to this group
                  </Text>
                )}

                {teamMembers.length === 0 && (
                  <Text style={styles.emptyMembersText}>
                    No team members available. Add team members first.
                  </Text>
                )}

                <PressableRow style={styles.doneButton} onPress={() => setManageMembersVisible(false)} >
                  <Text style={styles.doneButtonText}>Done</Text>
                </PressableRow>
              </ScrollView>
        </View>
      </AppBottomSheet>
    </View>
  );
}
