import { createContext, useContext, useEffect, useState, useMemo, useCallback, useRef } from 'react';

type Theme = 'dark' | 'light' | 'system';

interface BrandTheme {
  primaryColor: string;
  customThemeEnabled: boolean;
}

// Module-level storage for brand theme to persist across HMR and component remounts
// This is the single source of truth
let globalBrandTheme: BrandTheme | null = null;

function getGlobalBrandTheme(): BrandTheme {
  // Return cached value if available (persists across HMR)
  if (globalBrandTheme) {
    return globalBrandTheme;
  }
  
  // Try to load from localStorage (check new key first, then migrate old key)
  let saved = localStorage.getItem('jobrunner-brand-theme');
  if (!saved) {
    const oldSaved = localStorage.getItem('tradietrack-brand-theme');
    if (oldSaved) {
      saved = oldSaved;
      localStorage.setItem('jobrunner-brand-theme', oldSaved);
      localStorage.removeItem('tradietrack-brand-theme');
    }
  }
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.primaryColor && /^#[0-9A-Fa-f]{6}$/.test(parsed.primaryColor)) {
        const isCustomColor = parsed.primaryColor.toUpperCase() !== '#2563EB';
        const explicitlyDisabled = parsed.customThemeEnabled === false;
        
        globalBrandTheme = {
          primaryColor: parsed.primaryColor,
          customThemeEnabled: isCustomColor && !explicitlyDisabled
        };
        return globalBrandTheme;
      } else {
        localStorage.removeItem('jobrunner-brand-theme');
      }
    } catch {
      localStorage.removeItem('jobrunner-brand-theme');
    }
  }
  
  // Default brand theme
  globalBrandTheme = {
    primaryColor: '#2563EB',
    customThemeEnabled: false
  };
  return globalBrandTheme;
}

function setGlobalBrandTheme(theme: BrandTheme) {
  globalBrandTheme = theme;
  localStorage.setItem('jobrunner-brand-theme', JSON.stringify(theme));
}

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  initialBrandTheme?: BrandTheme;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  setThemeWithSync: (theme: Theme) => void; // Also syncs to server
  brandTheme: BrandTheme;
  setBrandTheme: (theme: BrandTheme) => void;
  initializeFromServer: (serverTheme: Theme | null) => void;
};

const initialState: ThemeProviderState = {
  theme: 'light',
  setTheme: () => null,
  setThemeWithSync: () => null,
  brandTheme: {
    primaryColor: '#2563EB',
    customThemeEnabled: false
  },
  setBrandTheme: () => null,
  initializeFromServer: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

// Convert hex color to HSL values for CSS variables
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

// Calculate relative luminance for WCAG contrast
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Get contrast ratio between two colors
function getContrastRatio(color1: { r: number; g: number; b: number }, color2: { r: number; g: number; b: number }): number {
  const lum1 = getLuminance(color1.r, color1.g, color1.b);
  const lum2 = getLuminance(color2.r, color2.g, color2.b);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

// Convert HSL to RGB
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
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

  if (s === 0) {
    const gray = Math.round(l * 255);
    return { r: gray, g: gray, b: gray };
  }

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  
  return {
    r: Math.round(hue2rgb(p, q, h + 1/3) * 255),
    g: Math.round(hue2rgb(p, q, h) * 255),
    b: Math.round(hue2rgb(p, q, h - 1/3) * 255)
  };
}

// Get WCAG-compliant foreground color
function getSafeForegroundColor(bgHsl: { h: number; s: number; l: number }): string {
  const bgRgb = hslToRgb(bgHsl.h, bgHsl.s, bgHsl.l);
  const whiteRgb = { r: 255, g: 255, b: 255 };
  const blackRgb = { r: 0, g: 0, b: 0 };
  
  const whiteContrast = getContrastRatio(bgRgb, whiteRgb);
  const blackContrast = getContrastRatio(bgRgb, blackRgb);
  
  // Use white if it has better contrast, otherwise black
  return whiteContrast > blackContrast ? "0 0% 98%" : "0 0% 9%";
}

// Generate professional color palette with proper contrast and neutral surfaces
function generateColorVariations(baseColor: string, isDarkMode: boolean) {
  // Validate hex color format (must be #XXXXXX)
  if (!baseColor || !/^#[0-9A-Fa-f]{6}$/.test(baseColor)) return null;
  
  const hsl = hexToHsl(baseColor);
  
  // Safety check for NaN values (malformed colors)
  if (isNaN(hsl.h) || isNaN(hsl.s) || isNaN(hsl.l)) return null;
  
  if (isDarkMode) {
    // Dark mode: Neutral surfaces with limited brand application
    const primaryL = Math.min(Math.max(hsl.l, 55), 70); // Bright but not neon
    const primaryS = Math.min(hsl.s, 85); // Prevent oversaturation
    
    return {
      // Primary brand color - only for buttons and key interactions
      primary: `${hsl.h} ${primaryS}% ${primaryL}%`,
      primaryForeground: getSafeForegroundColor({ h: hsl.h, s: primaryS, l: primaryL }),
      
      // Neutral surfaces - no brand bleed
      sidebar: `0 0% 4%`, // Very dark neutral surface
      sidebarForeground: `0 0% 98%`, // High contrast white text
      card: `0 0% 6%`, // Slightly elevated from background
      cardForeground: `0 0% 98%`,
      border: `0 0% 14%`, // Subtle neutral border
      muted: `0 0% 8%`, // Neutral muted areas
      mutedForeground: `0 0% 65%`,
      
      // Subtle brand accent - very low saturation for small highlights
      accent: `${hsl.h} 8% 15%`,
      accentForeground: `0 0% 98%`,
    };
  } else {
    // Light mode: Clean, neutral surfaces
    const primaryL = Math.min(Math.max(hsl.l, 40), 55); // Dark enough for contrast
    const primaryS = Math.min(hsl.s, 85); // Prevent oversaturation
    
    return {
      // Primary brand color - only for buttons and key interactions  
      primary: `${hsl.h} ${primaryS}% ${primaryL}%`,
      primaryForeground: getSafeForegroundColor({ h: hsl.h, s: primaryS, l: primaryL }),
      
      // Neutral surfaces - clean and professional
      sidebar: `0 0% 100%`, // Pure white sidebar
      sidebarForeground: `0 0% 9%`, // High contrast dark text
      card: `0 0% 100%`, // Pure white cards
      cardForeground: `0 0% 9%`,
      border: `0 0% 89%`, // Subtle neutral border
      muted: `0 0% 96%`, // Light neutral muted areas
      mutedForeground: `0 0% 45%`,
      
      // Subtle brand accent - very low saturation
      accent: `${hsl.h} 6% 96%`,
      accentForeground: `0 0% 9%`,
    };
  }
}

export function ThemeProvider({
  children,
  defaultTheme = 'light',
  storageKey = 'jobrunner-ui-theme',
  initialBrandTheme,
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  // Initialize brandTheme from global storage (persists across HMR)
  const [brandTheme, setBrandThemeState] = useState<BrandTheme>(() => getGlobalBrandTheme());

  // Stable setBrandTheme wrapper that updates both state and global storage
  const stableSetBrandTheme = useCallback((newTheme: BrandTheme) => {
    // Update global storage (persists across HMR and remounts)
    setGlobalBrandTheme(newTheme);
    // Update React state (triggers re-render)
    setBrandThemeState(newTheme);
  }, []);

  // Helper function to apply brand colors to DOM
  const applyBrandColors = useCallback((color: string, enabled: boolean, isDarkMode: boolean) => {
    const root = document.documentElement;
    
    // Determine if we should use the custom color:
    // - If enabled is explicitly true, use the custom color
    // - If enabled is explicitly false, use the default (user disabled custom theme)
    const DEFAULT_COLOR = '#2563EB';
    const isValidColor = color && /^#[0-9A-Fa-f]{6}$/i.test(color);
    const effectiveColor = enabled && isValidColor ? color : DEFAULT_COLOR;
    const isCustomColor = isValidColor && color.toUpperCase() !== DEFAULT_COLOR.toUpperCase();
    
    const variations = generateColorVariations(effectiveColor, isDarkMode);
    
    if (variations) {
      // Apply brand colors - use correct CSS variable names from index.css
      root.style.setProperty('--primary', variations.primary);
      root.style.setProperty('--primary-foreground', variations.primaryForeground);
      root.style.setProperty('--sidebar', variations.sidebar);
      root.style.setProperty('--sidebar-foreground', variations.sidebarForeground);
      root.style.setProperty('--card', variations.card);
      root.style.setProperty('--card-foreground', variations.cardForeground);
      root.style.setProperty('--accent', variations.accent);
      root.style.setProperty('--accent-foreground', variations.accentForeground);
      root.style.setProperty('--border', variations.border);
      root.style.setProperty('--muted', variations.muted);
      root.style.setProperty('--muted-foreground', variations.mutedForeground);
      
      // Also apply to --trade variables used across the app
      const hsl = hexToHsl(effectiveColor);
      const tradeL = isDarkMode ? Math.min(Math.max(hsl.l, 55), 70) : Math.min(Math.max(hsl.l, 40), 55);
      const tradeS = Math.min(hsl.s, 85);
      root.style.setProperty('--trade', `${hsl.h} ${tradeS}% ${tradeL}%`);
      root.style.setProperty('--trade-bg', isDarkMode ? `${hsl.h} 15% 15%` : `${hsl.h} 15% 96%`);
      root.style.setProperty('--trade-border', isDarkMode ? `${hsl.h} 20% 35%` : `${hsl.h} 20% 75%`);
      root.style.setProperty('--trade-accent', `${hsl.h} 25% ${isDarkMode ? 50 : 40}%`);
      root.style.setProperty('--trade-glow', `${hsl.h} 35% ${isDarkMode ? 25 : 85}%`);
      root.style.setProperty('--ring', `${hsl.h} ${tradeS}% ${tradeL}%`);
      
      // Apply brand color to sidebar-specific variables for consistent theming
      root.style.setProperty('--sidebar-primary', variations.primary);
      root.style.setProperty('--sidebar-primary-foreground', variations.primaryForeground);
      root.style.setProperty('--sidebar-accent', variations.accent);
      root.style.setProperty('--sidebar-accent-foreground', variations.accentForeground);
      root.style.setProperty('--sidebar-ring', `${hsl.h} ${tradeS}% ${tradeL}%`);
      // Update sidebar border to match brand color palette
      root.style.setProperty('--sidebar-border', variations.border);
      
      // Set data-custom-theme only if enabled (user has explicitly enabled custom theme)
      if (enabled && isCustomColor) {
        root.setAttribute('data-custom-theme', 'true');
      } else {
        root.removeAttribute('data-custom-theme');
      }
    }
  }, []);

  // Apply light/dark theme AND brand colors together to prevent flash
  useEffect(() => {
    const root = window.document.documentElement;

    root.classList.remove('light', 'dark');

    let isDarkMode = false;
    if (theme === 'system') {
      isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
      root.classList.add(isDarkMode ? 'dark' : 'light');
    } else {
      isDarkMode = theme === 'dark';
      root.classList.add(theme);
    }
    
    // Use the most up-to-date brand theme values
    // Priority: globalBrandTheme (module-level, updated synchronously) > brandTheme (React state)
    // This ensures we always use the freshest values even during React render cycles
    const effectiveBrandTheme = globalBrandTheme || brandTheme;
    
    // Immediately apply brand colors after setting the theme class
    // This prevents a flash of default colors
    applyBrandColors(effectiveBrandTheme.primaryColor, effectiveBrandTheme.customThemeEnabled, isDarkMode);
  }, [theme, brandTheme, applyBrandColors]);

  // Memoize setTheme to prevent infinite re-renders (local only)
  const stableSetTheme = useCallback((newTheme: Theme) => {
    localStorage.setItem(storageKey, newTheme);
    setTheme(newTheme);
  }, [storageKey]);

  // Set theme AND sync to server - use this for user-initiated changes
  const setThemeWithSync = useCallback((newTheme: Theme) => {
    localStorage.setItem(storageKey, newTheme);
    setTheme(newTheme);
    
    // Sync to server in background (don't await to avoid blocking UI)
    fetch('/api/user/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ themeMode: newTheme })
    }).catch(err => console.warn('Failed to sync theme to server:', err));
  }, [storageKey]);

  // Initialize from server theme (called after fetching business settings)
  const initializeFromServer = useCallback((serverTheme: Theme | null) => {
    if (serverTheme && ['light', 'dark', 'system'].includes(serverTheme)) {
      localStorage.setItem(storageKey, serverTheme);
      setTheme(serverTheme);
    }
  }, [storageKey]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo(() => ({
    theme,
    setTheme: stableSetTheme,
    setThemeWithSync,
    brandTheme,
    setBrandTheme: stableSetBrandTheme,
    initializeFromServer,
  }), [theme, stableSetTheme, setThemeWithSync, brandTheme, stableSetBrandTheme, initializeFromServer]);

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error('useTheme must be used within a ThemeProvider');

  return context;
};