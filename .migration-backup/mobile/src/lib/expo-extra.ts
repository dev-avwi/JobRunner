import Constants from 'expo-constants';

export interface ExpoExtras {
  apiUrl?: string;
  devApiUrl?: string;
  easProfile?: string;
}

export function getExpoExtras(): ExpoExtras {
  return (Constants.expoConfig?.extra ?? {}) as ExpoExtras;
}

interface DevHostShape {
  expoConfig?: { hostUri?: string };
  manifest2?: { extra?: { expoClient?: { hostUri?: string } } };
  manifest?: { debuggerHost?: string };
}

export function getDevHostUri(): string | undefined {
  const c = Constants as unknown as DevHostShape;
  return (
    c.expoConfig?.hostUri
    || c.manifest2?.extra?.expoClient?.hostUri
    || c.manifest?.debuggerHost
  );
}
