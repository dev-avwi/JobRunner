import { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import AppBottomSheet from './ui/AppBottomSheet';
import { Button } from './ui/Button';
import { useTheme } from '../lib/theme';
import { spacing, typography, radius } from '../lib/design-tokens';
import { useAuthStore } from '../lib/store';
import {
  shouldShowWhatsNew,
  markWhatsNewShown,
} from '../lib/whats-new';
import type { WhatsNewRelease } from '../lib/whats-new-content';

export function WhatsNewSheet() {
  const { colors } = useTheme();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [release, setRelease] = useState<WhatsNewRelease | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const r = await shouldShowWhatsNew();
      if (!cancelled && r) {
        setRelease(r);
        setVisible(true);
        markWhatsNewShown(r.version);
      }
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isAuthenticated]);

  const handleDismiss = () => setVisible(false);

  if (!release) return null;

  return (
    <AppBottomSheet
      visible={visible}
      onDismiss={handleDismiss}
      title={release.headline}
      showCloseButton
      scrollable
      footer={
        <Button fullWidth onPress={handleDismiss}>
          Got it
        </Button>
      }
    >
      <View style={{ gap: spacing.lg, paddingTop: spacing.sm }}>
        <Text
          style={[
            typography.caption,
            { color: colors.mutedForeground },
          ]}
        >
          Version {release.version}
        </Text>
        {release.items.map((item, idx) => (
          <View key={idx} style={styles.row}>
            <View
              style={[
                styles.iconWrap,
                {
                  backgroundColor: `${colors.primary}20`,
                  borderRadius: radius.md,
                },
              ]}
            >
              <Feather
                name={item.icon as keyof typeof Feather.glyphMap}
                size={20}
                color={colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={[
                  typography.body,
                  { color: colors.foreground, fontWeight: '600', marginBottom: 2 },
                ]}
              >
                {item.title}
              </Text>
              <Text
                style={[
                  typography.caption,
                  { color: colors.mutedForeground, lineHeight: 18 },
                ]}
              >
                {item.description}
              </Text>
            </View>
          </View>
        ))}
      </View>
    </AppBottomSheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
