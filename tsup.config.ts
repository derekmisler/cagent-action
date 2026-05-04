import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'tsup';

// Auto-discover entries: every src/<name>/index.ts becomes dist/<name>.js
const srcDir = resolve(import.meta.dirname, 'src');
const entry = Object.fromEntries(
  readdirSync(srcDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(resolve(srcDir, d.name, 'index.ts')))
    .map((d) => [d.name, resolve(srcDir, d.name, 'index.ts')]),
);

export default defineConfig({
  entry,
  format: ['esm'],
  // Target Node.js explicitly so esbuild resolves the "node" export condition
  // in AWS SDK packages instead of the browser variant (which pulls in
  // DOMParser / document and breaks at runtime in a GitHub Action).
  platform: 'node',
  target: 'node24',
  outDir: 'dist',
  // Keep .js extension so the action can `node dist/credentials.js` directly.
  // Without this tsup would emit .mjs for ESM format.
  outExtension: () => ({ js: '.js' }),
  // Sourcemaps disabled: this action is consumed via `uses: docker/cagent-action@v1`,
  // which clones the tagged release including dist/. Sourcemaps would add ~10MB to every
  // consumer clone with no runtime benefit (Node doesn't load them by default).
  sourcemap: false,
  clean: true,
  // Disable code splitting so each entry is fully self-contained.
  splitting: false,
  // tsup's externalizeDepsPlugin marks all node_modules as external by default.
  // The action runs `node dist/credentials.js` with no node_modules present at
  // runtime, so every npm dependency (AWS SDK, @actions/core, @octokit/…) must
  // be bundled in. Node.js built-ins stay external automatically (platform:'node').
  noExternal: [/.*/],
});
