import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit-Tests für reine Logik (ohne Datenbank). Aufruf: npm test
 * "server-only" wird durch ein leeres Modul ersetzt, damit Hilfsfunktionen aus
 * serverseitigen Dateien testbar sind (die Tests laufen ohnehin nur in Node).
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@\/(.*)$/, replacement: fileURLToPath(new URL("./src/$1", import.meta.url)) },
      { find: /^server-only$/, replacement: fileURLToPath(new URL("./node_modules/next/dist/compiled/server-only/empty.js", import.meta.url)) },
    ],
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    exclude: ["node_modules/**", ".next/**", "src/generated/**"],
    env: { TZ: "UTC", AUTH_SECRET: "vitest-secret-0123456789abcdef0123456789abcdef" },
    testTimeout: 10_000,
  },
});
