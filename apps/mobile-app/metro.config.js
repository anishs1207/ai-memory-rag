const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);

// npm hoists some workspace dependencies to the repository root. Always resolve
// mobile packages first so Expo Router cannot load a different Expo/React copy.
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, "node_modules"),
  path.resolve(__dirname, "../../node_modules"),
];

module.exports = withNativeWind(config, { input: "./src/global.css" });
