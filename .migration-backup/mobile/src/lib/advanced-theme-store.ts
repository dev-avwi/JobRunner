import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance } from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ColorPalette {
  primary: string;
  primaryLight: string;
  primaryForeground: string;
  accent: string;
  accentLight: string;
  accentForeground: string;
  success: string;
  successLight: string;
  warning: string;
  warningLight: string;
  destructive: string;
  destructiveLight: string;
  info: string;
  infoLight: string;
}

export interface TypographySettings {
  fontScale: number; // 0.8 - 1.2
  headingWeight: 'normal' | 'medium' | 'semibold' | 'bold';
  bodyLineHeight: number; // 1.2 - 1.8
}

export interface AppearanceSettings {
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'xl';
  shadowIntensity: 'none' | 'subtle' | 'medium' | 'strong';
  animationSpeed: 'reduced' | 'normal' | 'fast';
  compactMode: boolean;
}

export interface ThemePreset {
  id: string;
  name: string;
  description?: string;
  lightPalette: ColorPalette;
  darkPalette: ColorPalette;
  typography: TypographySettings;
  appearance: AppearanceSettings;
}

const DEFAULT_LIGHT_PALETTE: ColorPalette = {
  primary: '#3b82f6',
  primaryLight: '#eff6ff',
  primaryForeground: '#ffffff',
  accent: '#8b5cf6',
  accentLight: '#f5f3ff',
  accentForeground: '#ffffff',
  success: '#22c55e',
  successLight: '#f0fdf4',
  warning: '#f59e0b',
  warningLight: '#fffbeb',
  destructive: '#ef4444',
  destructiveLight: '#fef2f2',
  info: '#3b82f6',
  infoLight: '#eff6ff',
};

const DEFAULT_DARK_PALETTE: ColorPalette = {
  primary: '#60a5fa',
  primaryLight: '#1e3a5f',
  primaryForeground: '#ffffff',
  accent: '#a78bfa',
  accentLight: '#2e1065',
  accentForeground: '#ffffff',
  success: '#4ade80',
  successLight: '#052e16',
  warning: '#fbbf24',
  warningLight: '#422006',
  destructive: '#f87171',
  destructiveLight: '#450a0a',
  info: '#60a5fa',
  infoLight: '#1e3a5f',
};

const DEFAULT_TYPOGRAPHY: TypographySettings = {
  fontScale: 1,
  headingWeight: 'bold',
  bodyLineHeight: 1.5,
};

const DEFAULT_APPEARANCE: AppearanceSettings = {
  borderRadius: 'lg',
  shadowIntensity: 'subtle',
  animationSpeed: 'normal',
  compactMode: false,
};

export const PRESET_THEMES: ThemePreset[] = [
  {
    id: 'default',
    name: 'JobRunner Default',
    description: 'Clean blue theme optimised for tradies',
    lightPalette: DEFAULT_LIGHT_PALETTE,
    darkPalette: DEFAULT_DARK_PALETTE,
    typography: DEFAULT_TYPOGRAPHY,
    appearance: DEFAULT_APPEARANCE,
  },
  {
    id: 'pro',
    name: 'Pro Dark',
    description: 'Sleek dark theme for professionals',
    lightPalette: {
      ...DEFAULT_LIGHT_PALETTE,
      primary: '#1f2937',
      primaryLight: '#f3f4f6',
    },
    darkPalette: {
      ...DEFAULT_DARK_PALETTE,
      primary: '#e5e7eb',
      primaryLight: '#374151',
    },
    typography: DEFAULT_TYPOGRAPHY,
    appearance: { ...DEFAULT_APPEARANCE, shadowIntensity: 'medium' },
  },
  {
    id: 'nature',
    name: 'Nature Green',
    description: 'Earthy green theme for eco-friendly businesses',
    lightPalette: {
      ...DEFAULT_LIGHT_PALETTE,
      primary: '#16a34a',
      primaryLight: '#dcfce7',
    },
    darkPalette: {
      ...DEFAULT_DARK_PALETTE,
      primary: '#4ade80',
      primaryLight: '#14532d',
    },
    typography: DEFAULT_TYPOGRAPHY,
    appearance: DEFAULT_APPEARANCE,
  },
  {
    id: 'sunset',
    name: 'Sunset Orange',
    description: 'Warm orange theme with energy',
    lightPalette: {
      ...DEFAULT_LIGHT_PALETTE,
      primary: '#ea580c',
      primaryLight: '#fff7ed',
    },
    darkPalette: {
      ...DEFAULT_DARK_PALETTE,
      primary: '#fb923c',
      primaryLight: '#431407',
    },
    typography: DEFAULT_TYPOGRAPHY,
    appearance: DEFAULT_APPEARANCE,
  },
  {
    id: 'royal',
    name: 'Royal Purple',
    description: 'Premium purple theme for luxury services',
    lightPalette: {
      ...DEFAULT_LIGHT_PALETTE,
      primary: '#7c3aed',
      primaryLight: '#f5f3ff',
    },
    darkPalette: {
      ...DEFAULT_DARK_PALETTE,
      primary: '#a78bfa',
      primaryLight: '#2e1065',
    },
    typography: DEFAULT_TYPOGRAPHY,
    appearance: { ...DEFAULT_APPEARANCE, borderRadius: 'xl' },
  },
];

interface AdvancedThemeState {
  // Basic mode
  mode: ThemeMode;
  
  // Active preset
  activePresetId: string;
  
  // Custom overrides
  customPalette: Partial<ColorPalette> | null;
  customTypography: Partial<TypographySettings> | null;
  customAppearance: Partial<AppearanceSettings> | null;
  
  // Actions
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  getEffectiveTheme: () => 'light' | 'dark';
  
  setActivePreset: (presetId: string) => void;
  setCustomPrimaryColor: (color: string) => void;
  setCustomPalette: (palette: Partial<ColorPalette>) => void;
  setTypography: (settings: Partial<TypographySettings>) => void;
  setAppearance: (settings: Partial<AppearanceSettings>) => void;
  
  resetToDefaults: () => void;
  
  // Computed getters
  getActivePalette: () => ColorPalette;
  getActiveTypography: () => TypographySettings;
  getActiveAppearance: () => AppearanceSettings;
}

const asyncStorage: StateStorage = {
  getItem: async (name: string) => {
    try {
      return await AsyncStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string) => {
    try {
      await AsyncStorage.setItem(name, value);
    } catch {
      if (__DEV__) console.warn('Failed to save theme preference');
    }
  },
  removeItem: async (name: string) => {
    try {
      await AsyncStorage.removeItem(name);
    } catch {
      if (__DEV__) console.warn('Failed to remove theme preference');
    }
  },
};

export const useAdvancedThemeStore = create<AdvancedThemeState>()(
  persist(
    (set, get) => ({
      mode: 'light',
      activePresetId: 'default',
      customPalette: null,
      customTypography: null,
      customAppearance: null,

      setMode: (mode: ThemeMode) => set({ mode }),
      
      toggleTheme: () => {
        const currentMode = get().mode;
        if (currentMode === 'light') {
          set({ mode: 'dark' });
        } else {
          set({ mode: 'light' });
        }
      },
      
      getEffectiveTheme: () => {
        const mode = get().mode;
        if (mode === 'system') {
          return Appearance.getColorScheme() || 'light';
        }
        return mode;
      },

      setActivePreset: (presetId: string) => {
        set({ activePresetId: presetId, customPalette: null });
      },

      setCustomPrimaryColor: (color: string) => {
        const lighterColor = adjustColorBrightness(color, 0.9);
        set({
          customPalette: {
            ...get().customPalette,
            primary: color,
            primaryLight: lighterColor,
          },
        });
      },

      setCustomPalette: (palette: Partial<ColorPalette>) => {
        set({
          customPalette: { ...get().customPalette, ...palette },
        });
      },

      setTypography: (settings: Partial<TypographySettings>) => {
        set({
          customTypography: { ...get().customTypography, ...settings },
        });
      },

      setAppearance: (settings: Partial<AppearanceSettings>) => {
        set({
          customAppearance: { ...get().customAppearance, ...settings },
        });
      },

      resetToDefaults: () => {
        set({
          mode: 'light',
          activePresetId: 'default',
          customPalette: null,
          customTypography: null,
          customAppearance: null,
        });
      },

      getActivePalette: () => {
        const { activePresetId, customPalette } = get();
        const effectiveTheme = get().getEffectiveTheme();
        const preset = PRESET_THEMES.find(p => p.id === activePresetId) || PRESET_THEMES[0];
        const basePalette = effectiveTheme === 'dark' ? preset.darkPalette : preset.lightPalette;
        
        return { ...basePalette, ...customPalette };
      },

      getActiveTypography: () => {
        const { activePresetId, customTypography } = get();
        const preset = PRESET_THEMES.find(p => p.id === activePresetId) || PRESET_THEMES[0];
        
        return { ...preset.typography, ...customTypography };
      },

      getActiveAppearance: () => {
        const { activePresetId, customAppearance } = get();
        const preset = PRESET_THEMES.find(p => p.id === activePresetId) || PRESET_THEMES[0];
        
        return { ...preset.appearance, ...customAppearance };
      },
    }),
    {
      name: 'advanced-theme-storage',
      storage: createJSONStorage(() => asyncStorage),
    }
  )
);

// Helper function to adjust color brightness
function adjustColorBrightness(hex: string, factor: number): string {
  // Remove # if present
  hex = hex.replace('#', '');
  
  // Parse hex to RGB
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  
  // Adjust brightness
  const newR = Math.min(255, Math.floor(r + (255 - r) * factor));
  const newG = Math.min(255, Math.floor(g + (255 - g) * factor));
  const newB = Math.min(255, Math.floor(b + (255 - b) * factor));
  
  // Convert back to hex
  return `#${newR.toString(16).padStart(2, '0')}${newG.toString(16).padStart(2, '0')}${newB.toString(16).padStart(2, '0')}`;
}

export function getBorderRadiusValue(size: AppearanceSettings['borderRadius']): number {
  switch (size) {
    case 'none': return 0;
    case 'sm': return 4;
    case 'md': return 8;
    case 'lg': return 12;
    case 'xl': return 16;
    default: return 12;
  }
}

export function getFontScaleValue(scale: number): {
  small: number;
  body: number;
  subtitle: number;
  title: number;
  heading: number;
} {
  return {
    small: 12 * scale,
    body: 14 * scale,
    subtitle: 16 * scale,
    title: 20 * scale,
    heading: 28 * scale,
  };
}
