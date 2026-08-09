import { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  Linking,
  Platform,
} from 'react-native';
import { Alert } from '@/lib/alert';
import { router, Stack } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { PressableRow } from '../../src/components/ui/PressableRow';
import { useBottomInset } from '../../src/components/ui/BottomInsetSpacer';
import { useClientsStore } from '../../src/lib/store';
import { useTheme, ThemeColors } from '../../src/lib/theme';
import { spacing, radius, typography, iconSizes, pageShell, fontWeights } from '../../src/lib/design-tokens';
import api from '../../src/lib/api';

// The contact-import source tag written onto every imported client for
// traceability (shows up in the clients tag filter + referralSource).
const IMPORT_TAG = 'Contact Import';
const IMPORT_SOURCE = 'contact_import';

// expo-contacts is a native module: it only exists in builds made after the
// dependency was added. Probe first so older installed builds show a friendly
// "update the app" message instead of crashing at import time.
const contactsNativeAvailable = !!requireOptionalNativeModule('ExpoContacts');
// Lazy require so the JS module (which touches the native module at load
// time on some platforms) is never evaluated when the native side is absent.
const Contacts: typeof import('expo-contacts') | null = contactsNativeAvailable
  ? require('expo-contacts')
  : null;

/** Canonical AU phone form (+61...) for duplicate matching; null if unparseable. */
function normalizeAuPhone(raw?: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, '');
  if (digits.startsWith('+61')) return `+61${digits.slice(3).replace(/\D/g, '')}`;
  const bare = digits.replace(/\D/g, '');
  if (bare.startsWith('61') && bare.length === 11) return `+${bare}`;
  if (bare.length === 10 && bare.startsWith('0')) return `+61${bare.slice(1)}`;
  if (bare.length === 9) return `+61${bare}`;
  return bare.length >= 6 ? bare : null;
}

interface PickedContact {
  key: string;
  name: string;
  phone?: string;
  email?: string;
}

type DupeAction = 'skip' | 'merge' | 'keep';

interface PreviewRow extends PickedContact {
  duplicateOf?: { id: string; name: string };
  action: DupeAction; // for non-duplicates always 'keep'
}

type Phase = 'permission' | 'denied' | 'pick' | 'preview' | 'importing' | 'done';

export default function ImportContactsScreen() {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const bottomInset = useBottomInset();
  const { clients, fetchClients, createClient } = useClientsStore();

  const [phase, setPhase] = useState<Phase>('permission');
  const [loading, setLoading] = useState(false);
  const [deviceContacts, setDeviceContacts] = useState<PickedContact[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [search, setSearch] = useState('');
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [result, setResult] = useState({ imported: 0, merged: 0, skipped: 0, failed: 0 });

  const requestAndLoad = useCallback(async () => {
    if (!Contacts) return;
    setLoading(true);
    try {
      const { status } = await Contacts.requestPermissionsAsync();
      if (status !== 'granted') {
        setPhase('denied');
        return;
      }
      const { data } = await Contacts.getContactsAsync({
        fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers, Contacts.Fields.Emails],
        sort: Contacts.SortTypes.FirstName,
      });
      const mapped: PickedContact[] = (data || [])
        .map((c, i) => ({
          key: c.id || `contact-${i}`,
          name: (c.name || '').trim(),
          phone: c.phoneNumbers?.[0]?.number?.trim() || undefined,
          email: c.emails?.[0]?.email?.trim() || undefined,
        }))
        .filter((c) => c.name.length > 0 && (c.phone || c.email));
      setDeviceContacts(mapped);
      setPhase('pick');
    } catch (e) {
      if (__DEV__) console.log('[ImportContacts] load failed:', e);
      Alert.alert('Error', 'Could not read your contacts. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClients();
  }, []);

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return deviceContacts;
    return deviceContacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q)
    );
  }, [deviceContacts, search]);

  const selectedCount = useMemo(
    () => Object.values(selected).filter(Boolean).length,
    [selected]
  );

  const toggle = (key: string) =>
    setSelected((s) => ({ ...s, [key]: !s[key] }));

  const allFilteredSelected =
    filteredContacts.length > 0 && filteredContacts.every((c) => selected[c.key]);

  const toggleAllFiltered = () => {
    setSelected((s) => {
      const next = { ...s };
      for (const c of filteredContacts) next[c.key] = !allFilteredSelected;
      return next;
    });
  };

  const buildPreview = () => {
    const phoneIndex = new Map<string, { id: string; name: string }>();
    const emailIndex = new Map<string, { id: string; name: string }>();
    for (const cl of clients) {
      const p = normalizeAuPhone(cl.phone);
      if (p) phoneIndex.set(p, { id: cl.id, name: cl.name });
      if (cl.email) emailIndex.set(cl.email.trim().toLowerCase(), { id: cl.id, name: cl.name });
    }
    const rows: PreviewRow[] = deviceContacts
      .filter((c) => selected[c.key])
      .map((c) => {
        const p = normalizeAuPhone(c.phone);
        const dup =
          (p && phoneIndex.get(p)) ||
          (c.email && emailIndex.get(c.email.toLowerCase())) ||
          undefined;
        return {
          ...c,
          duplicateOf: dup || undefined,
          action: dup ? 'skip' : 'keep',
        };
      });
    setPreviewRows(rows);
    setPhase('preview');
  };

  const setRowAction = (key: string, action: DupeAction) =>
    setPreviewRows((rows) => rows.map((r) => (r.key === key ? { ...r, action } : r)));

  const runImport = async () => {
    setPhase('importing');
    let imported = 0, merged = 0, skipped = 0, failed = 0;
    for (const row of previewRows) {
      if (row.duplicateOf && row.action === 'skip') {
        skipped++;
        continue;
      }
      try {
        if (row.duplicateOf && row.action === 'merge') {
          // Fill in missing phone/email on the existing client only.
          const existing = clients.find((c) => c.id === row.duplicateOf!.id);
          const updates: Record<string, string> = {};
          if (row.phone && !existing?.phone) updates.phone = row.phone;
          if (row.email && !existing?.email) updates.email = row.email;
          if (Object.keys(updates).length > 0) {
            const res = await api.patch(`/api/clients/${row.duplicateOf.id}`, updates);
            if (res.error) { failed++; continue; }
          }
          merged++;
        } else {
          const created = await createClient({
            name: row.name,
            phone: row.phone,
            email: row.email,
            tags: [IMPORT_TAG],
            referralSource: IMPORT_SOURCE,
          });
          if (created) imported++; else failed++;
        }
      } catch {
        failed++;
      }
    }
    await fetchClients();
    setResult({ imported, merged, skipped, failed });
    setPhase('done');
  };

  const dupCount = previewRows.filter((r) => r.duplicateOf).length;

  // ---------- render helpers ----------

  const renderUnavailable = () => (
    <View style={styles.centerBox}>
      <Feather name="smartphone" size={iconSizes['4xl']} color={colors.mutedForeground} />
      <Text style={styles.centerTitle}>App update required</Text>
      <Text style={styles.centerText}>
        Importing phone contacts needs a newer version of the JobRunner app. Please update the app
        and try again.
      </Text>
    </View>
  );

  const renderPermission = () => (
    <View style={styles.centerBox}>
      <Feather name="users" size={iconSizes['4xl']} color={colors.primary} />
      <Text style={styles.centerTitle}>Import from your contacts</Text>
      <Text style={styles.centerText}>
        Bring your existing customers into JobRunner. We'll ask for one-time access to your
        contacts — you choose exactly which ones to import, and nothing is synced in the
        background.
      </Text>
      <PressableRow style={styles.primaryButton} onPress={requestAndLoad}>
        {loading ? (
          <ActivityIndicator color={colors.primaryForeground} />
        ) : (
          <>
            <Feather name="download" size={18} color={colors.primaryForeground} />
            <Text style={styles.primaryButtonText}>Choose Contacts</Text>
          </>
        )}
      </PressableRow>
    </View>
  );

  const renderDenied = () => (
    <View style={styles.centerBox}>
      <Feather name="lock" size={iconSizes['4xl']} color={colors.mutedForeground} />
      <Text style={styles.centerTitle}>Contacts access needed</Text>
      <Text style={styles.centerText}>
        JobRunner can't see your contacts without permission. Access is only used for this
        one-time import — contacts are never read in the background or shared. You can enable it
        in your phone's Settings.
      </Text>
      <PressableRow style={styles.primaryButton} onPress={() => Linking.openSettings()}>
        <Feather name="settings" size={18} color={colors.primaryForeground} />
        <Text style={styles.primaryButtonText}>Open Settings</Text>
      </PressableRow>
      <PressableRow style={styles.secondaryButton} onPress={requestAndLoad}>
        <Text style={styles.secondaryButtonText}>Try Again</Text>
      </PressableRow>
    </View>
  );

  const renderPickItem = ({ item }: { item: PickedContact }) => {
    const isSelected = !!selected[item.key];
    return (
      <PressableRow style={[styles.contactRow, isSelected && styles.contactRowSelected]} onPress={() => toggle(item.key)}>
        <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
          {isSelected && <Feather name="check" size={14} color={colors.primaryForeground} />}
        </View>
        <View style={styles.contactInfo}>
          <Text style={styles.contactName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.contactMeta} numberOfLines={1}>
            {[item.phone, item.email].filter(Boolean).join('  ·  ')}
          </Text>
        </View>
      </PressableRow>
    );
  };

  const renderPick = () => (
    <>
      <View style={styles.searchBar}>
        <Feather name="search" size={iconSizes.xl} color={colors.mutedForeground} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search contacts..."
          placeholderTextColor={colors.mutedForeground}
          value={search}
          onChangeText={setSearch}
        />
      </View>
      <View style={styles.pickToolbar}>
        <Text style={styles.pickCount}>
          {selectedCount} selected · {deviceContacts.length} contacts
        </Text>
        <PressableRow onPress={toggleAllFiltered}>
          <Text style={styles.selectAllText}>
            {allFilteredSelected ? 'Deselect all' : 'Select all'}
          </Text>
        </PressableRow>
      </View>
      <FlatList
        data={filteredContacts}
        keyExtractor={(c) => c.key}
        renderItem={renderPickItem}
        contentContainerStyle={{ paddingBottom: 100 + bottomInset }}
        ListEmptyComponent={
          <View style={styles.centerBox}>
            <Text style={styles.centerText}>
              {deviceContacts.length === 0
                ? 'No contacts with a phone number or email were found.'
                : 'No contacts match your search.'}
            </Text>
          </View>
        }
      />
      {selectedCount > 0 && (
        <View style={[styles.footerBar, { paddingBottom: spacing.md + bottomInset }]}>
          <PressableRow style={styles.primaryButton} onPress={buildPreview}>
            <Text style={styles.primaryButtonText}>
              Preview {selectedCount} {selectedCount === 1 ? 'contact' : 'contacts'}
            </Text>
            <Feather name="arrow-right" size={18} color={colors.primaryForeground} />
          </PressableRow>
        </View>
      )}
    </>
  );

  const renderPreviewItem = ({ item }: { item: PreviewRow }) => (
    <View style={styles.previewCard}>
      <View style={styles.previewHeader}>
        <Text style={styles.contactName} numberOfLines={1}>{item.name}</Text>
        {item.duplicateOf && (
          <View style={styles.dupBadge}>
            <Feather name="alert-triangle" size={12} color={colors.warning || '#b45309'} />
            <Text style={styles.dupBadgeText}>Duplicate</Text>
          </View>
        )}
      </View>
      {!!item.phone && (
        <View style={styles.fieldRow}>
          <Feather name="phone" size={14} color={colors.mutedForeground} />
          <Text style={styles.fieldText}>{item.phone}</Text>
        </View>
      )}
      {!!item.email && (
        <View style={styles.fieldRow}>
          <Feather name="mail" size={14} color={colors.mutedForeground} />
          <Text style={styles.fieldText}>{item.email}</Text>
        </View>
      )}
      {item.duplicateOf && (
        <>
          <Text style={styles.dupExplain}>
            Matches existing client "{item.duplicateOf.name}"
          </Text>
          <View style={styles.actionRow}>
            {(['skip', 'merge', 'keep'] as DupeAction[]).map((a) => (
              <PressableRow
                key={a}
                style={[styles.actionPill, item.action === a && styles.actionPillActive]}
                onPress={() => setRowAction(item.key, a)}
              >
                <Text style={[styles.actionPillText, item.action === a && styles.actionPillTextActive]}>
                  {a === 'skip' ? 'Skip' : a === 'merge' ? 'Merge' : 'Import anyway'}
                </Text>
              </PressableRow>
            ))}
          </View>
        </>
      )}
    </View>
  );

  const renderPreview = () => (
    <>
      <View style={styles.previewIntro}>
        <Text style={styles.pickCount}>
          {previewRows.length} to review
          {dupCount > 0 ? ` · ${dupCount} possible ${dupCount === 1 ? 'duplicate' : 'duplicates'}` : ''}
        </Text>
        {dupCount > 0 && (
          <Text style={styles.previewHint}>
            Merge fills missing phone/email on the existing client. Skip leaves it untouched.
          </Text>
        )}
      </View>
      <FlatList
        data={previewRows}
        keyExtractor={(r) => r.key}
        renderItem={renderPreviewItem}
        contentContainerStyle={{ paddingBottom: 100 + bottomInset }}
      />
      <View style={[styles.footerBar, { paddingBottom: spacing.md + bottomInset }]}>
        <PressableRow style={styles.secondaryButton} onPress={() => setPhase('pick')}>
          <Text style={styles.secondaryButtonText}>Back</Text>
        </PressableRow>
        <PressableRow style={[styles.primaryButton, { flex: 1 }]} onPress={runImport}>
          <Feather name="download" size={18} color={colors.primaryForeground} />
          <Text style={styles.primaryButtonText}>Import</Text>
        </PressableRow>
      </View>
    </>
  );

  const renderImporting = () => (
    <View style={styles.centerBox}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.centerText}>Importing contacts…</Text>
    </View>
  );

  const renderDone = () => (
    <View style={styles.centerBox}>
      <Feather name="check-circle" size={iconSizes['4xl']} color={colors.success || colors.primary} />
      <Text style={styles.centerTitle}>Import complete</Text>
      <Text style={styles.centerText}>
        {result.imported} imported
        {result.merged > 0 ? ` · ${result.merged} merged` : ''}
        {result.skipped > 0 ? ` · ${result.skipped} skipped` : ''}
        {result.failed > 0 ? ` · ${result.failed} failed` : ''}
      </Text>
      {result.failed > 0 && (
        <Text style={styles.centerText}>
          Some contacts couldn't be saved. Check your connection and try importing them again.
        </Text>
      )}
      <PressableRow style={styles.primaryButton} onPress={() => router.back()}>
        <Text style={styles.primaryButtonText}>Done</Text>
      </PressableRow>
    </View>
  );

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.pageHeader}>
        <View style={styles.headerLeft}>
          <Text style={styles.pageTitle}>Import Contacts</Text>
          <Text style={styles.pageSubtitle}>Bring phone contacts in as clients</Text>
        </View>
        <PressableRow style={styles.backButton} onPress={() => router.back()}>
          <Feather name="arrow-left" size={iconSizes.lg} color={colors.foreground} />
        </PressableRow>
      </View>
      {!Contacts
        ? renderUnavailable()
        : phase === 'permission'
        ? renderPermission()
        : phase === 'denied'
        ? renderDenied()
        : phase === 'pick'
        ? renderPick()
        : phase === 'preview'
        ? renderPreview()
        : phase === 'importing'
        ? renderImporting()
        : renderDone()}
    </View>
  );
}

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      paddingTop: pageShell.paddingTop,
    },
    pageHeader: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      paddingHorizontal: pageShell.paddingHorizontal,
      paddingTop: spacing.sm,
      marginBottom: spacing.sm,
    },
    headerLeft: { flex: 1 },
    pageTitle: {
      ...typography.pageTitle,
      color: colors.foreground,
    },
    pageSubtitle: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    backButton: {
      padding: spacing.sm,
      borderRadius: radius.lg,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
    },
    centerBox: {
      flexGrow: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      gap: spacing.md,
    },
    centerTitle: {
      ...typography.headline,
      color: colors.foreground,
      textAlign: 'center',
    },
    centerText: {
      ...typography.body,
      color: colors.mutedForeground,
      textAlign: 'center',
      lineHeight: 21,
    },
    primaryButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      backgroundColor: colors.primary,
      paddingVertical: 13,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.lg,
      marginTop: spacing.sm,
    },
    primaryButtonText: {
      ...typography.bodySemibold,
      color: colors.primaryForeground,
      fontWeight: fontWeights.semibold,
    },
    secondaryButton: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 13,
      paddingHorizontal: spacing.xl,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.card,
    },
    secondaryButtonText: {
      ...typography.bodySemibold,
      color: colors.foreground,
      fontWeight: fontWeights.semibold,
    },
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      marginHorizontal: spacing.lg,
      marginTop: spacing.md,
    },
    searchInput: {
      flex: 1,
      paddingVertical: Platform.OS === 'ios' ? 12 : 10,
      ...typography.body,
      color: colors.foreground,
      letterSpacing: 0,
      textAlign: 'left',
    },
    pickToolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    pickCount: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    selectAllText: {
      ...typography.bodySemibold,
      color: colors.primary,
      fontWeight: fontWeights.semibold,
    },
    contactRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.md,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
    },
    contactRowSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },
    checkbox: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 2,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
    },
    checkboxChecked: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    contactInfo: { flex: 1 },
    contactName: {
      ...typography.bodySemibold,
      color: colors.foreground,
      fontWeight: fontWeights.semibold,
    },
    contactMeta: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    footerBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.md,
      backgroundColor: colors.background,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    previewIntro: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      gap: spacing.xs,
    },
    previewHint: {
      ...typography.caption,
      color: colors.mutedForeground,
    },
    previewCard: {
      backgroundColor: colors.card,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.md,
      marginHorizontal: spacing.lg,
      marginBottom: spacing.sm,
      gap: spacing.xs,
    },
    previewHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    dupBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: 'rgba(245, 158, 11, 0.12)',
      borderRadius: radius.full,
      paddingHorizontal: spacing.sm,
      paddingVertical: 3,
    },
    dupBadgeText: {
      fontSize: typography.sizes.xs,
      fontWeight: fontWeights.semibold,
      color: '#b45309',
    },
    fieldRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    fieldText: {
      ...typography.body,
      color: colors.foreground,
    },
    dupExplain: {
      ...typography.caption,
      color: colors.mutedForeground,
      marginTop: 2,
    },
    actionRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    actionPill: {
      borderRadius: radius.full,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      paddingVertical: 6,
      backgroundColor: colors.card,
    },
    actionPillActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    actionPillText: {
      fontSize: typography.sizes.sm,
      fontWeight: fontWeights.semibold,
      color: colors.mutedForeground,
    },
    actionPillTextActive: {
      color: colors.primaryForeground,
    },
  });
