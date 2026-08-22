/**
 * Vitest config for pure TypeScript utility tests in the mobile package.
 *
 * This config runs only files under src/utils (and any other pure-TS helpers
 * added later). It deliberately does NOT load the jest-expo / React Native
 * setup, which is only needed for component tests run via the `jest` script.
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/utils/**/*.test.ts"],
  },
});
