import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import * as SecureStore from 'expo-secure-store';
import { Linking, Platform } from 'react-native';

export type MapsPreference = 'apple' | 'google' | null;

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
      if (__DEV__) console.warn('Failed to save maps preference');
    }
  },
  removeItem: async (name: string) => {
    try {
      await SecureStore.deleteItemAsync(name);
    } catch {
      if (__DEV__) console.warn('Failed to remove maps preference');
    }
  },
};

interface MapsState {
  mapsPreference: MapsPreference;
  setMapsPreference: (preference: MapsPreference) => void;
  showPreferenceModal: boolean;
  setShowPreferenceModal: (show: boolean) => void;
  pendingNavigation: { latitude: number; longitude: number; address?: string } | null;
  setPendingNavigation: (nav: { latitude: number; longitude: number; address?: string } | null) => void;
}

export const useMapsStore = create<MapsState>()(
  persist(
    (set, get) => ({
      mapsPreference: null,
      showPreferenceModal: false,
      pendingNavigation: null,
      
      setMapsPreference: (preference: MapsPreference) => {
        set({ mapsPreference: preference });
      },
      
      setShowPreferenceModal: (show: boolean) => {
        set({ showPreferenceModal: show });
      },
      
      setPendingNavigation: (nav) => {
        set({ pendingNavigation: nav });
      },
    }),
    {
      name: 'maps-preference-storage',
      storage: createJSONStorage(() => secureStorage),
      partialize: (state) => ({ mapsPreference: state.mapsPreference }),
    }
  )
);

export function openMapsWithPreference(
  latitude: number,
  longitude: number,
  address?: string
): boolean {
  const { mapsPreference, setShowPreferenceModal, setPendingNavigation } = useMapsStore.getState();
  
  if (mapsPreference === null) {
    setPendingNavigation({ latitude, longitude, address });
    setShowPreferenceModal(true);
    return false;
  }
  
  openMapsDirectly(latitude, longitude, mapsPreference, address);
  return true;
}

export function openMapsDirectly(
  latitude: number,
  longitude: number,
  preference: 'apple' | 'google',
  address?: string
): void {
  const encodedAddress = address ? encodeURIComponent(address) : '';
  
  if (address) {
    openMapsAddressDirectly(address, preference);
    return;
  }
  
  if (preference === 'apple') {
    const url = `maps://app?daddr=${latitude},${longitude}&dirflg=d`;
    Linking.openURL(url).catch(() => {
      Linking.openURL(`https://maps.google.com/maps?daddr=${latitude},${longitude}`);
    });
  } else {
    if (Platform.OS === 'android') {
      Linking.canOpenURL('google.navigation:q=0,0').then((supported) => {
        if (supported) {
          Linking.openURL(`google.navigation:q=${latitude},${longitude}`);
        } else {
          Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`);
        }
      });
    } else {
      Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`);
    }
  }
}

export function openMapsWithAddress(address: string): boolean {
  const { mapsPreference, setShowPreferenceModal, setPendingNavigation } = useMapsStore.getState();
  
  if (mapsPreference === null) {
    setPendingNavigation({ latitude: 0, longitude: 0, address });
    setShowPreferenceModal(true);
    return false;
  }
  
  openMapsAddressDirectly(address, mapsPreference);
  return true;
}

export function openMapsAddressDirectly(address: string, preference: 'apple' | 'google'): void {
  const encodedAddress = encodeURIComponent(address);
  
  if (preference === 'apple') {
    const url = Platform.select({
      ios: `maps:?q=${encodedAddress}`,
      android: `geo:0,0?q=${encodedAddress}`,
      default: `https://maps.google.com/?q=${encodedAddress}`,
    });
    Linking.openURL(url);
  } else {
    Linking.openURL(`https://maps.google.com/?q=${encodedAddress}`);
  }
}
