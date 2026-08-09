import { createContext, useContext, useState, useEffect, ReactNode, useMemo } from 'react';
import { useColorScheme, Platform, Appearance } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from './store';
import { useAdvancedThemeStore } from './advanced-theme-store';

type ThemeMode = 'light' | 'dark' | 'system';

export interface ThemeColors {
  background: string;
  card: string;
  cardBorder: string;
  cardHover: string;
  muted: string;
  primary: string;
  primaryDark: string;
  primaryLight: string;
  primaryForeground: string;
  foreground: string;
  mutedForeground: string;
  secondaryText: string;
  border: string;
  borderLight: string;
  secondary: string;
  secondaryForeground: string;
  accent: string;
  accentForeground: string;
  sidebar: string;
  sidebarForeground: string;
  success: string;
  successForeground: string;
  successLight: string;
  successDark: string;
  warning: string;
  warningForeground: string;
  warningLight: string;
  warningDark: string;
  // Alias of `destructive` so legacy callers using `colors.error` still type.
  error: string;
  destructive: string;
  destructiveForeground: string;
  destructiveLight: string;
  destructiveDark: string;
  info: string;
  infoForeground: string;
  infoLight: string;
  pending: string;
  pendingBg: string;
  scheduled: string;
  scheduledBg: string;
  inProgress: string;
  inProgressBg: string;
  done: string;
  doneBg: string;
  invoiced: string;
  invoicedBg: string;
  input: string;
  ring: string;
  shadow: string;
  elevate1: string;
  elevate2: string;
  buttonOutline: string;
  badgeOutline: string;
  promoBorder: string;
  white: string;
  ripple: string;
  isDark: boolean;
}

export interface ThemeShadows {
  none: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  xs: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  sm: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
  md: {
    shadowColor: string;
    shadowOffset: { width: number; height: number };
    shadowOpacity: number;
    shadowRadius: number;
    elevation: number;
  };
}

const DEFAULT_BRAND_COLOR = '#2563EB';

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100)
  };
}

function hslToHex(h: number, s: number, l: number): string {
  h = h / 360;
  s = s / 100;
  l = l / 100;
  
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return 1;
  
  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

function getSafeForegroundColor(bgHex: string): string {
  // Prefer white text on brand-coloured surfaces — that's the conventional,
  // expected look for solid buttons. A pure "max contrast" pick flips to dark
  // text on bright/light brand colours (e.g. a vivid blue, where black scores
  // marginally higher than white), which looks broken. Only fall back to dark
  // text when white genuinely fails readable contrast for bold/large UI text
  // (~3:1, WCAG AA for large text & UI components) — e.g. light yellows/cyans.
  const whiteContrast = getContrastRatio(bgHex, '#ffffff');
  return whiteContrast >= 3.0 ? '#ffffff' : '#1f2733';
}

// Minimum contrast ratio for button visibility (WCAG AA large text / UI components).
// Button labels are bold/large, so 3.0 is the correct bar — keeping this at 4.5
// made vivid brand blues fall back to a generic blue instead of using the user's
// own brand colour with white text.
const MIN_BG_CONTRAST = 3.0;
const MIN_TEXT_CONTRAST = 3.0;

// Guaranteed visible fallback - vibrant blue works on any background
const FALLBACK_BUTTON = {
  bg: '#2563EB',
  bgPressed: '#1D4ED8', 
  border: '#1D4ED8',
  text: '#ffffff',
};

// Get button colors that are guaranteed to be visible
// Tries to use brand colors with computed safe text, falls back to blue if needed
export function getVisibleButtonColors(
  primary: string,
  primaryDark: string,
  _primaryForeground: string, // Ignored - we compute our own safe text color
  cardBg: string,
  _isDark: boolean
): { bg: string; bgPressed: string; border: string; text: string } {
  // Check if brand color has enough contrast against card background
  const bgContrast = getContrastRatio(primary, cardBg);
  
  if (bgContrast >= MIN_BG_CONTRAST) {
    // Brand color is visible against card - compute safe text color
    const safeText = getSafeForegroundColor(primary);
    const textContrast = getContrastRatio(safeText, primary);
    
    // Verify text is readable
    if (textContrast >= MIN_TEXT_CONTRAST) {
      return {
        bg: primary,
        bgPressed: primaryDark,
        border: primaryDark,
        text: safeText,
      };
    }
  }
  
  // Fallback to guaranteed visible blue
  return FALLBACK_BUTTON;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16),
      }
    : null;
}

/**
 * Safely converts a color (hex or hsl) to rgba with specified opacity.
 * Handles both hex colors (#RRGGBB) and HSL strings (hsl(...)).
 * If conversion fails, uses the provided fallbackColor or defaults to primary blue.
 */
export function colorWithOpacity(color: string, opacity: number, fallbackColor?: string): string {
  // Default fallback is theme primary blue
  const defaultFallback = `rgba(59, 89, 152, ${opacity})`;
  
  if (!color || typeof color !== 'string') {
    return fallbackColor || defaultFallback;
  }
  
  const cleanColor = color.trim();
  
  // Handle hex colors
  if (cleanColor.startsWith('#')) {
    const rgb = hexToRgb(cleanColor);
    if (rgb) {
      return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
    }
  }
  
  // Handle HSL colors: hsl(h s% l%) or hsl(h, s%, l%)
  const hslMatch = cleanColor.match(/hsl\(\s*(\d+)\s*[,\s]\s*(\d+(?:\.\d+)?)\s*%?\s*[,\s]\s*(\d+(?:\.\d+)?)\s*%?\s*\)/i);
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]);
    const s = parseFloat(hslMatch[2]) / 100;
    const l = parseFloat(hslMatch[3]) / 100;
    
    // Convert HSL to RGB
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = l - c / 2;
    let r = 0, g = 0, b = 0;
    
    if (h < 60) { r = c; g = x; }
    else if (h < 120) { r = x; g = c; }
    else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; }
    else if (h < 300) { r = x; b = c; }
    else { r = c; b = x; }
    
    r = Math.round((r + m) * 255);
    g = Math.round((g + m) * 255);
    b = Math.round((b + m) * 255);
    
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }
  
  // For unknown formats, use provided fallback or default primary blue
  return fallbackColor || defaultFallback;
}

function generateBrandPalette(brandColor: string, isDark: boolean): Partial<ThemeColors> {
  if (!brandColor || !/^#[0-9A-Fa-f]{6}$/.test(brandColor)) {
    return {};
  }

  const hsl = hexToHsl(brandColor);
  if (isNaN(hsl.h) || isNaN(hsl.s) || isNaN(hsl.l)) {
    return {};
  }

  if (isDark) {
    const primaryL = Math.min(Math.max(hsl.l, 55), 70);
    const primaryS = Math.min(hsl.s, 85);
    const primaryHex = hslToHex(hsl.h, primaryS, primaryL);
    
    return {
      primary: primaryHex,
      primaryDark: hslToHex(hsl.h, primaryS, Math.max(primaryL - 15, 35)),
      primaryLight: hslToHex(hsl.h, 25, 20),
      primaryForeground: getSafeForegroundColor(primaryHex),
      accent: hslToHex(hsl.h, 8, 18),
      accentForeground: '#eef2f5',
      info: primaryHex,
      infoLight: hslToHex(hsl.h, 25, 20),
      scheduled: primaryHex,
      scheduledBg: hslToHex(hsl.h, 25, 20),
      ring: primaryHex,
    };
  } else {
    const primaryL = Math.min(Math.max(hsl.l, 40), 55);
    const primaryS = Math.min(hsl.s, 85);
    const primaryHex = hslToHex(hsl.h, primaryS, primaryL);
    
    return {
      primary: primaryHex,
      primaryDark: hslToHex(hsl.h, primaryS, Math.max(primaryL - 10, 30)),
      primaryLight: hslToHex(hsl.h, 30, 94),
      primaryForeground: getSafeForegroundColor(primaryHex),
      accent: hslToHex(hsl.h, 6, 96),
      accentForeground: '#1f2733',
      info: primaryHex,
      infoLight: hslToHex(hsl.h, 30, 94),
      scheduled: primaryHex,
      scheduledBg: hslToHex(hsl.h, 30, 94),
      ring: primaryHex,
    };
  }
}

const lightColors: ThemeColors = {
  background: '#fafafa',
  card: '#f5f5f5',
  cardBorder: '#dde1e8',
  cardHover: '#f0f0f0',
  muted: '#ededed',
  primary: '#1f2733',
  primaryDark: '#171a1d',
  primaryLight: '#e8eaed',
  primaryForeground: '#f8fbfe',
  foreground: '#1f2733',
  mutedForeground: '#6b7280',
  secondaryText: '#4a5159',
  border: '#e5e7eb',
  borderLight: '#dde1e8',
  secondary: '#e3e3e3',
  secondaryForeground: '#1f2733',
  accent: '#e0e4ea',
  accentForeground: '#1f2733',
  sidebar: '#f0f0f0',
  sidebarForeground: '#1f2733',
  success: '#26a556',
  successForeground: '#fafafa',
  successLight: '#e6f5eb',
  successDark: '#1d8242',
  warning: '#f29d0a',
  warningForeground: '#1a1a1a',
  warningLight: '#fef5e0',
  warningDark: '#c98204',
  error: '#e94444',
  destructive: '#e94444',
  destructiveForeground: '#fafafa',
  destructiveLight: '#fce8e8',
  destructiveDark: '#c62828',
  info: '#2196f3',
  infoForeground: '#fafafa',
  infoLight: '#e3f2fd',
  pending: '#f29d0a',
  pendingBg: '#fef5e0',
  scheduled: '#2196f3',
  scheduledBg: '#e3f2fd',
  inProgress: '#26a556',
  inProgressBg: '#e6f5eb',
  done: '#0d9668',
  doneBg: '#e0f7ef',
  invoiced: '#7c3aed',
  invoicedBg: '#ede9fe',
  input: '#b5bac3',
  ring: '#1f2733',
  shadow: 'rgba(0, 0, 0, 0.06)',
  elevate1: 'rgba(0, 0, 0, 0.03)',
  elevate2: 'rgba(0, 0, 0, 0.08)',
  buttonOutline: 'rgba(0, 0, 0, 0.10)',
  badgeOutline: 'rgba(0, 0, 0, 0.05)',
  promoBorder: '#c7d2fe',
  white: '#ffffff',
  ripple: 'rgba(0, 0, 0, 0.08)',
  isDark: false,
};

const darkColors: ThemeColors = {
  background: '#121417',
  card: '#181b20',
  cardBorder: '#232730',
  cardHover: '#1e2228',
  muted: '#1e2228',
  primary: '#eef2f5',
  primaryDark: '#d4dce3',
  primaryLight: '#262a32',
  primaryForeground: '#111418',
  foreground: '#eef2f5',
  mutedForeground: '#9aa0a8',
  secondaryText: '#c8ced6',
  border: '#22262e',
  borderLight: '#282d36',
  secondary: '#252a32',
  secondaryForeground: '#eef2f5',
  accent: '#282d36',
  accentForeground: '#eef2f5',
  sidebar: '#131720',
  sidebarForeground: '#eef2f5',
  success: '#3dc875',
  successForeground: '#1a1a1a',
  successLight: '#1a3d2a',
  successDark: '#25a352',
  warning: '#f5b019',
  warningForeground: '#1a1a1a',
  warningLight: '#3d2e15',
  warningDark: '#c98204',
  error: '#e94444',
  destructive: '#e94444',
  destructiveForeground: '#fafafa',
  destructiveLight: '#3d1a1a',
  destructiveDark: '#c62828',
  info: '#4aa8f5',
  infoForeground: '#1a1a1a',
  infoLight: '#1a2d3d',
  pending: '#f5b019',
  pendingBg: '#3d2e15',
  scheduled: '#4aa8f5',
  scheduledBg: '#1a2d3d',
  inProgress: '#3dc875',
  inProgressBg: '#1a3d2a',
  done: '#14b876',
  doneBg: '#153d2e',
  invoiced: '#9b5dff',
  invoicedBg: '#2a1f4d',
  input: '#4d5562',
  ring: '#eef2f5',
  shadow: 'rgba(0, 0, 0, 0.4)',
  elevate1: 'rgba(255, 255, 255, 0.04)',
  elevate2: 'rgba(255, 255, 255, 0.09)',
  buttonOutline: 'rgba(255, 255, 255, 0.10)',
  badgeOutline: 'rgba(255, 255, 255, 0.05)',
  promoBorder: '#3d4260',
  white: '#ffffff',
  ripple: 'rgba(255, 255, 255, 0.10)',
  isDark: true,
};

function getShadows(isDark: boolean): ThemeShadows {
  const shadowColor = isDark ? '#030508' : '#c6ccd4';
  const isAndroid = Platform.OS === 'android';

  // Android renders `elevation` as a noticeably heavier/wider/darker shadow than
  // the equivalent soft iOS shadow (shadowOffset/Opacity/Radius). Keeping the iOS
  // values but using much lower Android elevation brings the two platforms to the
  // same subtle, premium card shadow. The light `shadowColor` is also respected on
  // Android API 28+ to tint the shadow softer rather than pure black.

  return {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    xs: {
      shadowColor,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.5 : 0.4,
      shadowRadius: 2,
      elevation: isAndroid ? 0 : 1,
    },
    sm: {
      shadowColor,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: isDark ? 0.5 : 0.4,
      shadowRadius: 3,
      elevation: isAndroid ? 1 : 2,
    },
    md: {
      shadowColor,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: isDark ? 0.5 : 0.4,
      shadowRadius: 6,
      elevation: isAndroid ? 2 : 4,
    },
  };
}

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  colors: ThemeColors;
  shadows: ThemeShadows;
  brandColor: string | null;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');
  const [themeLoaded, setThemeLoaded] = useState(false);
  const { businessSettings } = useAuthStore();
  const brandColorFromSettings = businessSettings?.brandColor || businessSettings?.primaryColor || null;

  const advancedThemeMode = useAdvancedThemeStore(state => state.mode);
  const activePresetId = useAdvancedThemeStore(state => state.activePresetId);
  const customPalette = useAdvancedThemeStore(state => state.customPalette);
  const getActivePalette = useAdvancedThemeStore(state => state.getActivePalette);
  const setCustomPrimaryColor = useAdvancedThemeStore(state => state.setCustomPrimaryColor);
  
  useEffect(() => {
    SecureStore.getItemAsync('theme_mode').then(stored => {
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        setThemeModeState(stored);
      }
    }).catch((err) => {
      console.warn('Failed to load theme preference from SecureStore:', err);
    }).finally(() => {
      setThemeLoaded(true);
    });
  }, []);

  // Sync server-side brandColor to local advanced theme store
  // This ensures all devices show the same brand color (server is single source of truth)
  useEffect(() => {
    if (brandColorFromSettings && /^#[0-9A-Fa-f]{6}$/i.test(brandColorFromSettings)) {
      const serverColor = brandColorFromSettings.toUpperCase();
      const localColor = customPalette?.primary?.toUpperCase();
      
      // Only sync if server color differs from local (avoids unnecessary updates)
      if (serverColor !== localColor) {
        setCustomPrimaryColor(brandColorFromSettings);
      }
    }
  }, [brandColorFromSettings, customPalette?.primary, setCustomPrimaryColor]);

  const setThemeMode = async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await SecureStore.setItemAsync('theme_mode', mode);
    } catch (err) {
      console.warn('Failed to save theme preference to SecureStore:', err);
    }
  };

  const effectiveMode = advancedThemeMode || themeMode;
  const isDark = effectiveMode === 'system' 
    ? systemScheme === 'dark'
    : effectiveMode === 'dark';

  useEffect(() => {
    if (effectiveMode !== 'system') {
      Appearance.setColorScheme(isDark ? 'dark' : 'light');
    } else {
      Appearance.setColorScheme(null);
    }
  }, [effectiveMode, isDark]);

  const colors = useMemo(() => {
    const baseColors = isDark ? darkColors : lightColors;
    
    // Default blue colors for both light and dark modes (from preset defaults)
    const DEFAULT_LIGHT_BLUE = '#3B82F6';
    const DEFAULT_DARK_BLUE = '#60A5FA';
    
    // Helper to check if a color is a default preset blue (not a custom brand color)
    const isDefaultPresetBlue = (color: string): boolean => {
      const upper = color.toUpperCase();
      return upper === DEFAULT_LIGHT_BLUE || upper === DEFAULT_DARK_BLUE;
    };
    
    // Priority 1: Check if user has set a custom primary color in advanced theme store
    // customPalette?.primary is the definitive indicator of user customization
    if (customPalette?.primary && /^#[0-9A-Fa-f]{6}$/i.test(customPalette.primary)) {
      if (!isDefaultPresetBlue(customPalette.primary)) {
        const brandPalette = generateBrandPalette(customPalette.primary, isDark);
        return { ...baseColors, ...brandPalette };
      }
    }
    
    // Priority 2: Check if using a non-default preset
    if (activePresetId !== 'default') {
      const activePalette = getActivePalette();
      if (activePalette?.primary) {
        const brandPalette = generateBrandPalette(activePalette.primary, isDark);
        return { ...baseColors, ...brandPalette };
      }
    }
    
    // Priority 3: Fall back to business settings brand color (or default blue)
    const brandColor = brandColorFromSettings || DEFAULT_BRAND_COLOR;
    if (brandColor && /^#[0-9A-Fa-f]{6}$/i.test(brandColor)) {
      const brandPalette = generateBrandPalette(brandColor, isDark);
      return { ...baseColors, ...brandPalette };
    }
    
    return baseColors;
  }, [isDark, brandColorFromSettings, customPalette, activePresetId, getActivePalette]);

  const shadows = useMemo(() => getShadows(isDark), [isDark]);
  
  // Effective brand color - use active palette primary if customized, otherwise business settings
  const activePaletteForBrand = getActivePalette();
  const brandColor = activePaletteForBrand?.primary || customPalette?.primary || brandColorFromSettings || DEFAULT_BRAND_COLOR;

  if (!themeLoaded) {
    return null;
  }

  return (
    <ThemeContext.Provider value={{ themeMode, isDark, colors, shadows, brandColor, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (!context) {
    const defaultBrandPalette = generateBrandPalette(DEFAULT_BRAND_COLOR, false);
    return {
      themeMode: 'light',
      isDark: false,
      colors: { ...lightColors, ...defaultBrandPalette },
      shadows: getShadows(false),
      brandColor: DEFAULT_BRAND_COLOR,
      setThemeMode: () => {},
    };
  }
  return context;
}

export { lightColors, darkColors };
export type { ThemeMode };

export function useThemedStyles<T>(
  createStyles: (colors: ThemeColors, shadows: ThemeShadows, isDark: boolean) => T
): T {
  const { colors, shadows, isDark } = useTheme();
  return useMemo(() => createStyles(colors, shadows, isDark), [colors, shadows, isDark, createStyles]);
}
