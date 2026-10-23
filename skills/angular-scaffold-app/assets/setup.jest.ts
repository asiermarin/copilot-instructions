import { deserialize, serialize } from 'node:v8';
import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone/index.mjs';

setupZoneTestEnv();

// jsdom lacks structuredClone, which Angular Material uses.
if (typeof structuredClone === 'undefined') {
  Object.defineProperty(globalThis, 'structuredClone', {
    configurable: true,
    value: <T>(value: T): T => deserialize(serialize(value)) as T,
  });
}
