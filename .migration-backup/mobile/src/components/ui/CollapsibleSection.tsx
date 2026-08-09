import { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { PressableRow } from './PressableRow';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';
import { spacing, radius, shadows, iconSizes } from '../../lib/design-tokens';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CollapsibleSectionProps {
  summaryItems: string[];
  children: React.ReactNode;
  defaultExpanded?: boolean;
}

export function CollapsibleSection({ summaryItems, children, defaultExpanded = false }: CollapsibleSectionProps) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);
  const rotateAnim = useRef(new Animated.Value(defaultExpanded ? 1 : 0)).current;

  const toggle = useCallback(() => {
    const next = !expanded;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.timing(rotateAnim, {
      toValue: next ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
    setExpanded(next);
  }, [expanded, rotateAnim]);

  const rotation = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const summaryText = summaryItems.filter(Boolean).join(' · ');

  return (
    <View>
      <PressableRow onPress={toggle} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.card, borderRadius: radius.xl, paddingVertical: spacing.md, paddingHorizontal: spacing.lg, marginBottom: spacing.md, borderWidth: 1, borderColor: colors.cardBorder, ...shadows.sm, gap: spacing.sm, }} >
        <View style={{
          width: 32,
          height: 32,
          borderRadius: radius.md,
          backgroundColor: `${colors.primary}15`,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <Feather name="layers" size={iconSizes.md} color={colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: colors.foreground,
          }}>
            More Details
          </Text>
          {!expanded && summaryText.length > 0 && (
            <Text
              style={{
                fontSize: 12,
                color: colors.mutedForeground,
                marginTop: 2,
              }}
              numberOfLines={1}
            >
              {summaryText}
            </Text>
          )}
        </View>
        <Animated.View style={{ transform: [{ rotate: rotation }] }}>
          <Feather name="chevron-down" size={iconSizes.lg} color={colors.mutedForeground} />
        </Animated.View>
      </PressableRow>

      {expanded && (
        <View>
          {children}
        </View>
      )}
    </View>
  );
}
