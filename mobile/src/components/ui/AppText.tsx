import { Text as RNText, TextProps as RNTextProps, TextStyle, StyleProp } from 'react-native';
import { typography } from '../../lib/design-tokens';

type TypographyTokens = typeof typography;
export type AppTextVariant = keyof TypographyTokens;

export interface AppTextProps extends RNTextProps {
  variant?: AppTextVariant;
  color?: string;
}

export function AppText({ variant = 'body' as AppTextVariant, color, style, ...rest }: AppTextProps) {
  const variantStyle = typography[variant] as TextStyle | undefined;
  const composed: StyleProp<TextStyle> = [variantStyle, color ? { color } : null, style];
  return <RNText {...rest} style={composed} />;
}

export default AppText;
