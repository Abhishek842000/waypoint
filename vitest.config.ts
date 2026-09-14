import path from "node:path";
import { defineConfig } from "vitest/config";
import swc from "unplugin-swc";

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: { syntax: "typescript", decorators: true },
        transform: { legacyDecorator: true, decoratorMetadata: true },
        target: "es2022",
      },
      module: { type: "es6" },
    }),
  ],
  resolve: {
    alias: {
      "@waypoint/db": path.resolve(__dirname, "packages/db/src/index.ts"),
      "@waypoint/shared-types": path.resolve(
        __dirname,
        "packages/shared-types/src/index.ts",
      ),
    },
  },
  test: {
    include: ["tests/integration/**/*.spec.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL:
        process.env.DATABASE_URL ??
        "postgresql://waypoint:waypoint@localhost:5433/waypoint?schema=public",
      JWT_SECRET: process.env.JWT_SECRET ?? "test-jwt-secret-not-for-production",
      WEB_ORIGIN: "http://localhost:3000",
    },
  },
});
