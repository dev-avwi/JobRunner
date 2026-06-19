const { withAndroidManifest, AndroidConfig } = require("expo/config-plugins");

// Foldables (and any device that crosses the tablet-width threshold) fire a
// configuration change when the screen is folded/unfolded. By default Android
// destroys and recreates the Activity on such a change, which fully remounts the
// React app — re-initializing Expo Router and the deep-link listener and
// producing the "linking configured in multiple places" error plus a jarring
// reload. Declaring these config changes on MainActivity tells Android to keep
// the Activity alive and let JS handle the resize via useWindowDimensions().
const CONFIG_CHANGES = [
  "keyboard",
  "keyboardHidden",
  "orientation",
  "screenSize",
  "screenLayout",
  "smallestScreenSize",
  "uiMode",
  "density",
  "navigation",
].join("|");

module.exports = function withAndroidFoldableConfigChanges(config) {
  return withAndroidManifest(config, (config) => {
    const mainActivity = AndroidConfig.Manifest.getMainActivityOrThrow(
      config.modResults
    );
    mainActivity.$["android:configChanges"] = CONFIG_CHANGES;
    return config;
  });
};
