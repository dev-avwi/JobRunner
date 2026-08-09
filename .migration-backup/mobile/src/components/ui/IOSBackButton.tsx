import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../lib/theme';

let LiquidGlassView: any = null;
let isLiquidGlassSupported = false;

if (Platform.OS === 'ios') {
  try {
    const lg = require('@callstack/liquid-glass');
    LiquidGlassView = lg.LiquidGlassView;
    isLiquidGlassSupported = lg.isLiquidGlassSupported;
  } catch (e) {}
}

interface IOSBackButtonProps {
  onPress?: () => void;
  label?: string;
}

export function IOSBackButton({ onPress, label = 'Back' }: IOSBackButtonProps) {
  const { colors } = useTheme();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.back();
    }
  };

  const content = (
    <>
      <Feather name="chevron-left" size={17} color={colors.primary} />
      <Text style={[styles.label, { color: colors.primary }]}>{label}</Text>
    </>
  );

  if (isLiquidGlassSupported && LiquidGlassView) {
    return (
      <Pressable
        onPress={handlePress}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <LiquidGlassView style={styles.capsule} effect="regular">
          {content}
        </LiquidGlassView>
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handlePress}
      style={styles.capsule}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 4,
    paddingRight: 10,
    height: 30,
    borderRadius: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '400',
    marginLeft: -1,
  },
});
