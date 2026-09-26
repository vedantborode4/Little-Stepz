// Custom entry.
//
// `require` rather than `import` throughout: ES imports are hoisted, and the
// whole point of this file is to control the order in which startup work runs.
//
// The boot trace must be first so that whatever dies next is recorded. See
// src/lib/boot-trace.ts for why a synchronous file write is the only sink that
// survives the iOS launch abort.
const { beginBootTrace, mark, markError, guard } = require("./src/lib/boot-trace");

beginBootTrace();

// A JS-level global handler cannot catch the native NSException we are chasing,
// but it does catch everything else, and recording instead of terminating keeps
// the app alive long enough to show the trace screen.
guard("errorutils:install", () => {
  const ErrorUtils = global.ErrorUtils;
  if (!ErrorUtils?.setGlobalHandler) return;
  const previousHandler = ErrorUtils.getGlobalHandler?.();
  ErrorUtils.setGlobalHandler((err, isFatal) => {
    markError(isFatal ? "js:fatal" : "js:error", err);
    if (!isFatal && previousHandler) previousHandler(err, isFatal);
  });
});

// react-native-gesture-handler must be imported before react-native initializes
// (standalone-build requirement; Expo Go pre-loads it, which is why it only bites
// release builds).
mark("require:gesture-handler");
require("react-native-gesture-handler");

// Polyfills that must exist before expo-router / react-native initialize.
mark("require:polyfills");
require("./src/polyfills");

mark("require:expo-router-entry");
require("expo-router/entry");

mark("entry:done");
