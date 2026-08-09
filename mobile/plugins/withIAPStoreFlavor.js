const { withAppBuildGradle } = require("expo/config-plugins");

module.exports = function withIAPStoreFlavor(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language === "groovy") {
      const buildGradle = config.modResults.contents;
      if (!buildGradle.includes('missingDimensionStrategy')) {
        config.modResults.contents = buildGradle.replace(
          /defaultConfig\s*\{/,
          `defaultConfig {\n        missingDimensionStrategy "store", "play"`
        );
      }
    }
    return config;
  });
};
