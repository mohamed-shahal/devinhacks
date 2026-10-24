import '@testing-library/jest-dom/vitest';

// Node 25 provides its own localStorage, which Vitest leaves on the global.
// UI tests must use the actual jsdom Storage, just as browser tests do.
declare const jsdom: { window: Window };
if (typeof window !== 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: jsdom.window.localStorage,
  });
}
