const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

module.exports = function withIAPKotlinFix(config) {
  return withDangerousMod(config, [
    "android",
    async (config) => {
      const iapModulePath = path.join(
        config.modRequest.projectRoot,
        "node_modules",
        "react-native-iap",
        "android",
        "src",
        "play",
        "java",
        "com",
        "dooboolab",
        "rniap",
        "RNIapModule.kt"
      );

      if (fs.existsSync(iapModulePath)) {
        let content = fs.readFileSync(iapModulePath, "utf-8");
        const original = content;

        content = content.replace(
          /val activity = currentActivity\b/g,
          "val activity = reactApplicationContext.currentActivity"
        );

        if (content !== original) {
          fs.writeFileSync(iapModulePath, content, "utf-8");
          console.log("[withIAPKotlinFix] Patched RNIapModule.kt: replaced currentActivity with reactApplicationContext.currentActivity");
        } else {
          console.log("[withIAPKotlinFix] RNIapModule.kt already patched or pattern not found");
        }
      } else {
        console.warn("[withIAPKotlinFix] RNIapModule.kt not found at:", iapModulePath);
      }

      return config;
    },
  ]);
};
