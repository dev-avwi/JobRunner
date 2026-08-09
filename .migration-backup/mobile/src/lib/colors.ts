/**
 * @deprecated This file provides default static colors only.
 * For dynamic theming that respects brand colors, use:
 * 
 *   import { useTheme } from '../lib/theme';
 *   const { colors } = useTheme();
 * 
 * For StyleSheet.create with dynamic colors, use:
 * 
 *   import { useThemedStyles, ThemeColors } from '../lib/theme';
 *   const createStyles = (colors: ThemeColors) => StyleSheet.create({ ... });
 *   const styles = useThemedStyles(createStyles);
 */

export const colors = {
  background: '#ffffff',
  card: '#ffffff',
  cardHover: '#fafafa',
  muted: '#f5f5f5',
  
  primary: '#2563EB',
  primaryDark: '#0a5047',
  primaryLight: '#d1f0ed',
  primaryForeground: '#ffffff',
  
  foreground: '#0f172a',
  mutedForeground: '#737373',
  secondaryText: '#475569',
  
  border: '#e3e3e3',
  borderLight: '#f5f5f5',
  
  accent: '#f5f5f5',
  accentForeground: '#171717',
  sidebar: '#ffffff',
  sidebarForeground: '#171717',
  
  success: '#22c55e',
  successLight: '#dcfce7',
  successDark: '#15803d',
  warning: '#f59e0b',
  warningLight: '#fef3c7',
  warningDark: '#d97706',
  destructive: '#ef4444',
  destructiveLight: '#fee2e2',
  destructiveDark: '#dc2626',
  info: '#2563EB',
  infoLight: '#d1f0ed',
  
  pending: '#f59e0b',
  pendingBg: '#fef3c7',
  scheduled: '#2563EB',
  scheduledBg: '#d1f0ed',
  inProgress: '#22c55e',
  inProgressBg: '#dcfce7',
  done: '#10b981',
  doneBg: '#d1fae5',
  invoiced: '#8b5cf6',
  invoicedBg: '#ede9fe',
  
  promo: '#e0e7ff',
  promoBorder: '#c7d2fe',
  white: '#ffffff',
  black: '#000000',
  shadow: 'rgba(0, 0, 0, 0.08)',
  ring: '#2563EB',
};

export default colors;
