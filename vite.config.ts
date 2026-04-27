import { existsSync, readdirSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

// Auto-discover entries: every src/<name>/index.ts is a build entry
const srcDir = resolve(import.meta.dirname, 'src');
const entries = Object.fromEntries(
  readdirSync(srcDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(resolve(srcDir, d.name, 'index.ts')))
    .map((d) => [d.name, resolve(srcDir, d.name, 'index.ts')]),
);

export default defineConfig({
  define: {
    'process.env': 'process.env',
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'node24',
    rollupOptions: {
      input: entries,
      output: {
        format: 'es',
        entryFileNames: '[name].js',
        chunkFileNames: 'chunks/[name].js',
        inlineDynamicImports: false,
      },
      external: [/^node:/, ...builtinModules.map((m) => new RegExp(`^${m}(/|$)`))],
      onwarn(warning, defaultHandler) {
        if (warning.code === 'CIRCULAR_DEPENDENCY') return;
        if (warning.code === 'THIS_IS_UNDEFINED') return;
        defaultHandler(warning);
      },
    },
  },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/__tests__/**/*.test.ts'],
          exclude: ['src/**/__tests__/**/*.integration.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['src/**/__tests__/**/*.integration.test.ts'],
        },
      },
    ],
  },
});
