import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../lib/theme';
import { colors as staticColors } from '../../lib/colors';
import { spacing, radius } from '../../lib/design-tokens';

interface XeroBadgeProps {
  size?: 'sm' | 'md';
}

export function XeroBadge({ size = 'sm' }: XeroBadgeProps) {
  const { colors } = useTheme();
  
  const isSmall = size === 'sm';
  
  return (
    <View style={[
      styles.container,
      isSmall ? styles.containerSm : styles.containerMd,
      { backgroundColor: '#13B5EA' }
    ]}>
      <Text style={[
        styles.text,
        isSmall ? styles.textSm : styles.textMd
      ]}>
        Xero
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: -4,
    right: -4,
    borderRadius: radius.sm,
    zIndex: 10,
  },
  containerSm: {
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
  },
  containerMd: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  text: {
    color: staticColors.white,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  textSm: {
    fontSize: 8,
  },
  textMd: {
    fontSize: 10,
  },
});

export default XeroBadge;
