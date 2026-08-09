import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../lib/theme';

interface XeroRibbonProps {
  size?: 'small' | 'medium';
}

export function XeroRibbon({ size = 'small' }: XeroRibbonProps) {
  const { colors } = useTheme();
  
  const ribbonSize = size === 'small' ? 50 : 60;
  const fontSize = size === 'small' ? 8 : 10;
  
  const styles = StyleSheet.create({
    ribbonContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: ribbonSize,
      height: ribbonSize,
      overflow: 'hidden',
      zIndex: 10,
    },
    ribbon: {
      position: 'absolute',
      top: 8,
      left: -18,
      width: 70,
      backgroundColor: '#13B5EA',
      transform: [{ rotate: '-45deg' }],
      paddingVertical: 2,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.2,
      shadowRadius: 2,
      elevation: 2,
    },
    ribbonText: {
      color: colors.white,
      fontSize: fontSize,
      fontWeight: '700', fontFamily: 'Inter_700Bold',
      letterSpacing: 0.5,
      textAlign: 'center',
    },
  });

  return (
    <View style={styles.ribbonContainer}>
      <View style={styles.ribbon}>
        <Text style={styles.ribbonText}>XERO</Text>
      </View>
    </View>
  );
}
