module.exports = function (api) {
  // api.env() keys the config cache on the env, so the production-only
  // console stripping below isn't frozen into the dev cache. Don't add
  // api.cache(true) — env() configures caching itself.
  const isProduction = api.env('production');
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      // Strip console.* from release builds (keep console.error for Sentry
      // breadcrumbs). Must come before the reanimated plugin, which is
      // required to be last.
      ...(isProduction ? [['transform-remove-console', { exclude: ['error'] }]] : []),
      'react-native-reanimated/plugin',
    ],
  };
};
