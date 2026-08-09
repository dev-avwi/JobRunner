const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// Add shared folder to watched folders
config.watchFolders = [
  path.resolve(__dirname, "../shared"),
];

// Allow importing from shared folder
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(__dirname, "../node_modules"),
];

module.exports = withNativeWind(config, { input: "./global.css" });
