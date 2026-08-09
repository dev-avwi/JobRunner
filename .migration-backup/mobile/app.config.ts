import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name || 'JobRunner',
  slug: config.slug || 'jobrunner',
  plugins: [
    ...(config.plugins || []),
    [
      '@sentry/react-native/expo',
      {
        organization: process.env.SENTRY_ORG || 'jobrunner',
        project: process.env.SENTRY_PROJECT || 'jobrunner-mobile',
      },
    ],
  ],
  extra: (() => {
    const profile = process.env.EAS_BUILD_PROFILE || process.env.APP_VARIANT;
    const isReleaseProfile =
      profile === 'production'
      || profile === 'preview'
      || process.env.NODE_ENV === 'production';
    const { apiUrl: _staticApiUrl, devApiUrl: _staticDevApiUrl, ...restExtra } =
      (config.extra ?? {}) as Record<string, unknown>;
    return {
      ...restExtra,
      apiUrl: process.env.EXPO_PUBLIC_API_URL || undefined,
      devApiUrl: process.env.EXPO_PUBLIC_DEV_API_URL || undefined,
      easProfile: profile || (isReleaseProfile ? 'production' : 'development'),
    };
  })(),
});
