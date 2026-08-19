import { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../lib/theme';
import { TeamAvatar } from './TeamAvatar';
import { spacing, radius, typography, fontWeights } from '../lib/design-tokens';

export function getTeamMemberId(member: any): string {
  return String(member?.userId || member?.memberId || member?.id || '');
}

export function getTeamMemberName(member: any): string {
  const name = member?.name?.trim();
  if (name) return name;
  const fullName = [member?.firstName, member?.lastName].filter(Boolean).join(' ').trim();
  return fullName || member?.email || 'Team Member';
}

export function getTeamMemberRole(member: any): string {
  const role = member?.roleName || member?.role || member?.user?.role;
  return role ? String(role).replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) : 'Team member';
}

interface PhaseTeamPickerProps {
  selectedIds: string[];
  teamMembers: any[];
  onChange: (ids: string[]) => void;
  onManageTeam: () => void;
  testID?: string;
}

/**
 * Inline multi-select that stays within the parent AppBottomSheet. Keeping the
 * list inline avoids stacking native modals while still allowing long teams to
 * use the sheet's scroll view and keyboard-safe footer.
 */
export function PhaseTeamPicker({
  selectedIds,
  teamMembers,
  onChange,
  onManageTeam,
  testID = 'phase-team',
}: PhaseTeamPickerProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const selectedMembers = useMemo(
    () => teamMembers.filter((member) => selectedIds.includes(getTeamMemberId(member))),
    [selectedIds, teamMembers],
  );

  const toggleMember = (memberId: string) => {
    onChange(
      selectedIds.includes(memberId)
        ? selectedIds.filter((id) => id !== memberId)
        : [...selectedIds, memberId],
    );
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ fontSize: typography.captionSmall.fontSize, fontWeight: fontWeights.medium, color: colors.mutedForeground }}>
        Phase team
      </Text>
      <TouchableOpacity
        testID={`${testID}-toggle`}
        onPress={() => setExpanded((value) => !value)}
        activeOpacity={0.7}
        style={{
          minHeight: 50,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: expanded ? colors.primary : colors.border,
          backgroundColor: colors.card,
          paddingHorizontal: spacing.md,
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
        }}
      >
        {selectedMembers.length > 0 ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {selectedMembers.slice(0, 3).map((member, index) => (
                <View key={getTeamMemberId(member)} style={{ marginLeft: index ? -8 : 0, borderWidth: 2, borderColor: colors.card, borderRadius: 16 }}>
                  <TeamAvatar
                    name={getTeamMemberName(member)}
                    firstName={member.firstName || member.user?.firstName}
                    lastName={member.lastName || member.user?.lastName}
                    email={member.email || member.user?.email}
                    userId={getTeamMemberId(member)}
                    profileImageUrl={member.profileImageUrl || member.user?.profileImageUrl}
                    themeColor={member.themeColor}
                    size={30}
                  />
                </View>
              ))}
            </View>
            <Text style={{ flex: 1, color: colors.foreground, fontSize: typography.sizes.sm }} numberOfLines={1}>
              {selectedMembers.length === 1
                ? getTeamMemberName(selectedMembers[0])
                : `${selectedMembers.length} team members selected`}
            </Text>
          </>
        ) : (
          <Text style={{ flex: 1, color: colors.mutedForeground, fontSize: typography.sizes.sm }}>
            Select one or more team members
          </Text>
        )}
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.mutedForeground} />
      </TouchableOpacity>

      {expanded && (
        <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.card }}>
          {teamMembers.length === 0 ? (
            <View style={{ padding: spacing.lg, alignItems: 'center', gap: spacing.xs }}>
              <Feather name="users" size={24} color={colors.mutedForeground} />
              <Text style={{ color: colors.mutedForeground, fontSize: typography.sizes.sm, textAlign: 'center' }}>
                No team members yet
              </Text>
              <TouchableOpacity onPress={onManageTeam} testID={`${testID}-manage-empty`} style={{ paddingVertical: spacing.xs }}>
                <Text style={{ color: colors.primary, fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold }}>
                  Invite or manage team members
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {teamMembers.map((member, index) => {
                const memberId = getTeamMemberId(member);
                const selected = selectedIds.includes(memberId);
                const name = getTeamMemberName(member);
                return (
                  <TouchableOpacity
                    key={memberId}
                    testID={`${testID}-member-${memberId}`}
                    onPress={() => toggleMember(memberId)}
                    activeOpacity={0.7}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.sm,
                      paddingHorizontal: spacing.md,
                      paddingVertical: spacing.sm,
                      borderTopWidth: index ? 1 : 0,
                      borderTopColor: colors.border,
                      backgroundColor: selected ? `${colors.primary}10` : colors.card,
                    }}
                  >
                    <View style={{
                      width: 22,
                      height: 22,
                      borderRadius: 6,
                      borderWidth: 2,
                      borderColor: selected ? colors.primary : colors.border,
                      backgroundColor: selected ? colors.primary : 'transparent',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {selected && <Feather name="check" size={14} color={colors.primaryForeground} />}
                    </View>
                    <TeamAvatar
                      name={name}
                      firstName={member.firstName || member.user?.firstName}
                      lastName={member.lastName || member.user?.lastName}
                      email={member.email || member.user?.email}
                      userId={memberId}
                      profileImageUrl={member.profileImageUrl || member.user?.profileImageUrl}
                      themeColor={member.themeColor}
                      size={36}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: colors.foreground, fontSize: typography.sizes.sm, fontWeight: fontWeights.medium }} numberOfLines={1}>
                        {name}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: typography.sizes.xs }} numberOfLines={1}>
                        {getTeamMemberRole(member)}{selected && selectedIds[0] === memberId ? ' · Lead assignee' : ''}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity
                testID={`${testID}-manage`}
                onPress={onManageTeam}
                activeOpacity={0.7}
                style={{
                  borderTopWidth: 1,
                  borderTopColor: colors.border,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  padding: spacing.md,
                }}
              >
                <Feather name="user-plus" size={16} color={colors.primary} />
                <Text style={{ color: colors.primary, fontSize: typography.sizes.sm, fontWeight: fontWeights.semibold }}>
                  Invite or manage team members
                </Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
      <Text style={{ color: colors.mutedForeground, fontSize: typography.sizes.xs, lineHeight: 17 }}>
        The first selected person is the lead assignee.
      </Text>
    </View>
  );
}