// Polyfills that must run BEFORE react-native / expo-router initialize.
// Some Hermes/Expo Go builds are missing web globals that RN 0.81 references
// during startup (e.g. DOMException), which throws "[runtime not ready]".

if (typeof globalThis.DOMException === "undefined") {
  class DOMExceptionPolyfill extends Error {
    code: number;
    constructor(message?: string, name?: string) {
      super(message);
      this.name = name || "Error";
      this.code = 0;
    }
  }
  // @ts-expect-error - assign to global
  globalThis.DOMException = DOMExceptionPolyfill;
}

export {};
