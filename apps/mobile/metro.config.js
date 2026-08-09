// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// 1. Watch only what the app actually resolves from — the pnpm store and workspace
//    packages — instead of the whole monorepo. Crawling apps/web (.next cache),
//    apps/backend and .git under OneDrive intermittently times out Metro's watcher
//    ("Failed to start watch mode"). projectRoot is always watched implicitly.
config.watchFolders = [
  path.resolve(monorepoRoot, "node_modules"),
  path.resolve(monorepoRoot, "packages"),
];

// 2. Resolve modules from the app first, then the hoisted root store (pnpm).
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

// 3. Needed for the "@repo/zod-schema/index" subpath export to resolve under pnpm.
config.resolver.unstable_enablePackageExports = true;

// 4. Inject global polyfills (DOMException) BEFORE React Native's InitializeCore,
//    which references them on startup. getPolyfills runs earliest of all.
const origGetPolyfills = config.serializer.getPolyfills;
config.serializer.getPolyfills = (opts) => [
  ...(origGetPolyfills ? origGetPolyfills(opts) : []),
  path.resolve(projectRoot, "src/polyfills.global.js"),
];

module.exports = withNativeWind(config, { input: "./src/global.css" });
