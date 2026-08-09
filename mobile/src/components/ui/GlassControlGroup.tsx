import { ReactNode } from 'react';
import { Platform, View, Pressable, StyleSheet } from 'react-native';
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

interface GlassControlItemProps {
  onPress: () => void;
  children: ReactNode;
  disabled?: boolean;
  testID?: string;
}

interface GlassControlGroupProps {
  items: GlassControlItemProps[];
}

export function GlassControlGroup({ items }: GlassControlGroupProps) {
  const { isDark } = useTheme();

  const separatorColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)';

  const controls = items.map((item, i) => (
    <View key={i} style={styles.itemRow}>
      {i > 0 && (
        <View style={[styles.separator, { backgroundColor: separatorColor }]} />
      )}
      <Pressable
        onPress={item.onPress}
        disabled={item.disabled}
        style={styles.touchTarget}
        hitSlop={{ top: 6, bottom: 6, left: 4, right: 4 }}
        testID={item.testID}
      >
        {item.children}
      </Pressable>
    </View>
  ));

  if (isLiquidGlassSupported && LiquidGlassView) {
    return (
      <LiquidGlassView style={styles.capsule} effect="regular">
        {controls}
      </LiquidGlassView>
    );
  }

  return (
    <View style={styles.capsule}>
      {controls}
    </View>
  );
}

const styles = StyleSheet.create({
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 30,
    borderRadius: 15,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: '100%',
  },
  separator: {
    width: StyleSheet.hairlineWidth,
    height: 14,
    marginHorizontal: 1,
  },
  touchTarget: {
    width: 32,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
