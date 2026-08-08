import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../src/lib/theme';
import { api } from '../../src/lib/api';
import { useAuthStore } from '../../src/lib/store';
import { invalidateTeamColors, type MemberColor } from '../../src/lib/team-colors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBottomNavHeight } from '../../src/components/BottomNav';
import { typography, fontWeights } from '../../src/lib/design-tokens';

interface ColorOption {
  color: string;
  available: boolean;
  isCurrentUser: boolean;
}

interface AvailableResponse {
  colors: ColorOption[];
  currentColor: string | null;
  usedCount: number;
  availableCount: number;
}

export default function MyColorScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomNavHeight = getBottomNavHeight(insets.bottom);
  const { user } = useAuthStore();
  const styles = useMemo(() => createStyles(colors, bottomNavHeight), [colors, bottomNavHeight]);

  const [options, setOptions] = useState<ColorOption[]>([]);
  const [currentColor, setCurrentColor] = useState<string | null>(null);
  const [owners, setOwners] = useState<Record<string, MemberColor>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [availRes, membersRes] = await Promise.all([
        api.get<AvailableResponse>('/api/team/colors/available'),
        api.get<MemberColor[]>('/api/team/members/colors'),
      ]);
      if (availRes.data?.colors) {
        setOptions(availRes.data.colors);
        setCurrentColor(availRes.data.currentColor ?? null);
      }
      if (Array.isArray(membersRes.data)) {
        const byColor: Record<string, MemberColor> = {};
        for (const m of membersRes.data) {
          if (m.themeColor && m.userId !== user?.id) {
            byColor[m.themeColor.toUpperCase()] = m;
          }
        }
        setOwners(byColor);
      }
    } catch (e) {
      console.error('Error loading colours:', e);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSelect = async (option: ColorOption) => {
    if (option.isCurrentUser || saving) return;
    if (!option.available) {
      const taken = owners[option.color.toUpperCase()];
      const who = taken ? `${taken.firstName} ${taken.lastName}`.trim() : 'another team member';
      Alert.alert('Colour taken', `That colour is already used by ${who}. Please pick a spare one.`);
      return;
    }
    setSaving(option.color);
    try {
      const res = await api.patch<{ success?: boolean }>('/api/user/theme-color', { themeColor: option.color });
      if (res.data?.success && !res.error) {
        invalidateTeamColors();
        await load();
      } else {
        Alert.alert('Could not save', res.error || 'Please try another colour.');
      }
    } catch (e: any) {
      Alert.alert('Could not save', e?.response?.data?.error || 'Please try another colour.');
    } finally {
      setSaving(null);
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: 'My Team Colour' }} />
      {loading ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.currentCard}>
            <View style={[styles.currentSwatch, { backgroundColor: currentColor || colors.primary }]}>
              <Feather name="user" size={26} color="#FFFFFF" />
            </View>
            <View style={styles.currentInfo}>
              <Text style={styles.currentTitle}>Your colour</Text>
              <Text style={styles.currentSub}>
                {currentColor
                  ? 'This colour identifies you across chat, scheduling and the team map.'
                  : 'Pick a colour to identify yourself across the team.'}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionLabel}>Choose a spare colour</Text>
          <Text style={styles.sectionHint}>
            Greyed-out colours are already taken by teammates. Tap a spare colour to make it yours.
          </Text>

          <View style={styles.grid}>
            {options.map((option) => {
              const taken = owners[option.color.toUpperCase()];
              const isMine = option.isCurrentUser;
              const dim = !option.available && !isMine;
              return (
                <View key={option.color} style={styles.swatchWrap}>
                  <PressableRow
                    style={styles.swatchPress}
                    onPress={() => handleSelect(option)}
                    disabled={isMine}
                  >
                    <View
                      style={[
                        styles.swatch,
                        { backgroundColor: option.color },
                        dim && styles.swatchDim,
                        isMine && styles.swatchMine,
                      ]}
                    >
                      {saving === option.color ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : isMine ? (
                        <Feather name="check" size={22} color="#FFFFFF" />
                      ) : dim ? (
                        <Text style={styles.swatchInitials}>{taken?.initials || ''}</Text>
                      ) : null}
                    </View>
                    <Text style={styles.swatchCaption} numberOfLines={1}>
                      {isMine ? 'You' : dim ? (taken?.firstName || 'Taken') : 'Spare'}
                    </Text>
                  </PressableRow>
                </View>
              );
            })}
          </View>
        </ScrollView>
      )}
    </View>
  );
}

const createStyles = (colors: any, bottomNavHeight: number) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    content: { padding: 16, paddingBottom: bottomNavHeight + 24 },
    currentCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 24,
    },
    currentSwatch: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
    },
    currentInfo: { flex: 1 },
    currentTitle: { fontSize: typography.subtitle.fontSize, fontWeight: fontWeights.bold, color: colors.foreground, marginBottom: 2 },
    currentSub: { fontSize: typography.sizes.sm, color: colors.mutedForeground, lineHeight: 18 },
    sectionLabel: { fontSize: typography.sizes.md, fontWeight: fontWeights.bold, color: colors.foreground, marginBottom: 4 },
    sectionHint: { fontSize: typography.sizes.sm, color: colors.mutedForeground, lineHeight: 18, marginBottom: 16 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 16, columnGap: 12 },
    swatchWrap: { width: '22%' },
    swatchPress: { width: '100%', alignItems: 'center' },
    swatch: {
      width: '100%',
      aspectRatio: 1,
      borderRadius: 14,
      alignItems: 'center',
      justifyContent: 'center',
    },
    swatchDim: { opacity: 0.35 },
    swatchMine: { borderWidth: 3, borderColor: colors.foreground },
    swatchInitials: { fontSize: typography.sizes.sm, fontWeight: fontWeights.bold, color: '#FFFFFF' },
    swatchCaption: {
      fontSize: typography.sizes.xs,
      color: colors.mutedForeground,
      marginTop: 6,
      width: '100%',
      textAlign: 'center',
    },
  });
