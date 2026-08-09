import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getExpoExtras } from './expo-extra';
import { WHATS_NEW_RELEASES, WhatsNewRelease } from './whats-new-content';

const KEY_PREFIX = 'jobrunner_whats_new_shown_v';

function currentVersion(): string {
  return Constants.expoConfig?.version || getExpoExtras().easProfile || '0.0.0';
}

function storageKey(version: string): string {
  return `${KEY_PREFIX}${version}`;
}

export function getReleaseForCurrentVersion(): WhatsNewRelease | null {
  return WHATS_NEW_RELEASES[currentVersion()] || null;
}

export async function shouldShowWhatsNew(): Promise<WhatsNewRelease | null> {
  if (Platform.OS === 'web') return null;
  try {
    const release = getReleaseForCurrentVersion();
    if (!release) return null;
    const already = await AsyncStorage.getItem(storageKey(release.version));
    if (already) return null;
    return release;
  } catch {
    return null;
  }
}

export async function markWhatsNewShown(version?: string): Promise<void> {
  try {
    const v = version || currentVersion();
    await AsyncStorage.setItem(storageKey(v), new Date().toISOString());
  } catch {
    /* noop */
  }
}

export async function resetWhatsNewForTesting(): Promise<void> {
  if (!__DEV__) return;
  try {
    await AsyncStorage.removeItem(storageKey(currentVersion()));
  } catch {
    /* noop */
  }
}
