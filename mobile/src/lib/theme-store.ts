import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { Appearance } from 'react-native';
import api from './api';

export type ThemeMode = 'light' | 'dark' | 'system';

const secureStorage: StateStorage = {
  getItem: async (name: string) => {
    try {
      return await SecureStore.getItemAsync(name);
    } catch {
      return null;
    }
  },
  setItem: async (name: string, value: string) => {
    try {
      await SecureStore.setItemAsync(name, value);
    } catch {
      if (__DEV__) console.warn('Failed to save theme preference');
    }
  },
  removeItem: async (name: string) => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {
      if (__DEV__) console.warn('Failed to remove theme preference');
    }
  },
};

interface ThemeState {
  mode: ThemeMode;
  hasSyncedFromServer: boolean;
  setMode: (mode: ThemeMode) => void;
  setModeWithSync: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  getEffectiveTheme: () => 'light' | 'dark';
  initializeFromServer: (serverTheme: ThemeMode | null) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'light',
      hasSyncedFromServer: false,
      
      setMode: (mode: ThemeMode) => set({ mode }),
      
      setModeWithSync: (mode: ThemeMode) => {
        set({ mode });
        api.request('PATCH', '/api/user/preferences', { themeMode: mode })
          .catch(err => { if (__DEV__) console.warn('Failed to sync theme to server:', err); });
      },
      
      toggleTheme: () => {
        const currentMode = get().mode;
        const newMode = currentMode === 'light' ? 'dark' : 'light';
        set({ mode: newMode });
        api.request('PATCH', '/api/user/preferences', { themeMode: newMode })
          .catch(err => { if (__DEV__) console.warn('Failed to sync theme to server:', err); });
      },
      
      getEffectiveTheme: () => {
        const mode = get().mode;
        if (mode === 'system') {
          return Appearance.getColorScheme() || 'light';
        }
        return mode;
      },
      
      initializeFromServer: (serverTheme: ThemeMode | null) => {
        if (serverTheme && ['light', 'dark', 'system'].includes(serverTheme)) {
          set({ mode: serverTheme, hasSyncedFromServer: true });
        }
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({ mode: state.mode }),
    }
  )
);
