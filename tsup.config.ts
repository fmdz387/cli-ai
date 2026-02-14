import { copyFileSync } from 'fs';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm'],
  target: 'node20',
  dts: false, // CLI tool -- no consumers need types
  clean: true,
  sourcemap: false,
  minify: true,

  // CRITICAL: Bundle ALL dependencies into the output file
  // This eliminates ESM resolution of 12 packages from node_modules at runtime
  // On Windows, this alone saves 30-50 seconds of startup time
  // Negative lookahead excludes native addons and optional deps that can't be bundled
  noExternal: [/^(?!@napi-rs\/keyring|react-devtools-core)/],

  // MUST keep native addons external -- they contain platform-specific .node binaries
  // that cannot be bundled by esbuild. At runtime, require() loads the correct binary.
  // react-devtools-core is an optional dep of ink, not installed in production.
  external: ['@napi-rs/keyring', 'react-devtools-core'],

  esbuildOptions(options) {
    options.drop = ['debugger'];
    options.legalComments = 'none';
    options.treeShaking = true;

    // Inject require() for CJS dependencies bundled into ESM output.
    // Some bundled deps use require('assert'), require('util'), etc.
    // ESM doesn't have require — createRequire provides it.
    options.banner = {
      js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
    };

    // Inline NODE_ENV at build time for dead code elimination
    // This allows esbuild to tree-shake React dev-only code paths
    options.define = {
      'process.env.NODE_ENV': '"production"',
    };
  },
  onSuccess: async () => {
    copyFileSync('src/cli.js', 'dist/cli.js');
  },
});
