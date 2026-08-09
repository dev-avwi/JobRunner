import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getExpoExtras } from './expo-extra';
import Constants from 'expo-constants';

const KEY_PREFIX = 'jobrunner_review_prompted_v';

function currentVersion(): string {
  return Constants.expoConfig?.version || getExpoExtras().easProfile || '0.0.0';
}

function storageKey(): string {
  return `${KEY_PREFIX}${currentVersion()}`;
}

export async function maybeRequestReview(eventName: string): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const key = storageKey();
    const already = await AsyncStorage.getItem(key);
    if (already) return;

    const available = await StoreReview.isAvailableAsync();
    if (!available) return;

    const hasAction = await StoreReview.hasAction();
    if (!hasAction) return;

    await AsyncStorage.setItem(key, new Date().toISOString());
    await StoreReview.requestReview();
    if (__DEV__) console.log(`[StoreReview] Prompt shown after: ${eventName}`);
  } catch (err) {
    if (__DEV__) console.log('[StoreReview] Skipped:', err);
  }
}

export async function hasShownReviewThisVersion(): Promise<boolean> {
  try {
    return Boolean(await AsyncStorage.getItem(storageKey()));
  } catch {
    return false;
  }
}

export async function resetReviewPromptForTesting(): Promise<void> {
  if (!__DEV__) return;
  try {
    await AsyncStorage.removeItem(storageKey());
  } catch {
    /* noop */
  }
}
