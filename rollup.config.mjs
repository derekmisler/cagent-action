import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import nodeExternals from 'rollup-plugin-node-externals';

/** @type {import('rollup').RollupOptions} */
export default {
  input: 'src/index.ts',
  // Suppress harmless warnings from third-party CJS/ESM code
  onwarn(warning, defaultHandler) {
    if (warning.code === 'CIRCULAR_DEPENDENCY') return;
    if (warning.code === 'THIS_IS_UNDEFINED') return;
    defaultHandler(warning);
  },
  output: {
    file: '.github/actions/setup-credentials/dist/setup-credentials.js',
    format: 'esm',
    sourcemap: true,
    inlineDynamicImports: true,
  },
  plugins: [
    // Externalize Node.js built-ins (available on runner); bundle all deps
    nodeExternals({ builtins: true, deps: false, devDeps: true }),
    resolve({ preferBuiltins: true }),
    commonjs(),
    json(),
    typescript({ tsconfig: './tsconfig.json', declaration: false, outDir: undefined }),
  ],
};
