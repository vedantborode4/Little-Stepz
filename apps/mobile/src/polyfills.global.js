// Injected via metro.config.js `serializer.getPolyfills` so it runs BEFORE
// React Native's InitializeCore (which, on some Hermes/Expo Go builds, references
// the missing `DOMException` global and throws "[runtime not ready]").
if (typeof globalThis.DOMException === "undefined") {
  globalThis.DOMException = class DOMException extends Error {
    constructor(message, name) {
      super(message);
      this.name = name || "Error";
      this.code = 0;
    }
  };
}
