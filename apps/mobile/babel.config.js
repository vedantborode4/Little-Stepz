module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
    plugins: [
      // babel-preset-expo (SDK 54) already transpiles class fields, #private
      // syntax and Flow types for the Hermes that Expo Go ships. Re-adding
      // @babel/plugin-transform-class-properties here turned RN core's Flow
      // type-only fields (e.g. Event's `NONE: number`) into runtime
      // `this.NONE = void 0` assignments, which collide with RN's read-only
      // `Object.defineProperty(Event.prototype, 'NONE')` → "Cannot assign to
      // read-only property 'NONE'" on the first event emit. Keep only worklets.
      // react-native-reanimated/worklets plugin must remain LAST.
      "react-native-worklets/plugin",
    ],
  };
};
