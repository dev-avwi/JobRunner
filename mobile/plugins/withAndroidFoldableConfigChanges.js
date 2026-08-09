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
    // Without this, some foldable emulators/devices letterbox + SCALE the
    // cover-display surface to fill the larger inner display instead of
    // actually resizing the window. The app then keeps reporting the small
    // (cover) dimensions to useWindowDimensions even while unfolded, so the
    // tablet sidebar never triggers. Forcing resizeableActivity=true makes the
    // OS hand the activity the real inner-display size on unfold.
    mainActivity.$["android:resizeableActivity"] = "true";
    return config;
  });
};
