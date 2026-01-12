import { copyFileSync } from 'fs';
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.tsx'],
  format: ['esm'],
  target: 'node20',
  dts: true,
  clean: true,
  sourcemap: false,
  minify: true,
  esbuildOptions(options) {
    options.drop = ['debugger'];
    options.legalComments = 'none';
    options.treeShaking = true;
  },
  onSuccess: async () => {
    // Copy CLI wrapper with warning suppression
    copyFileSync('src/cli.js', 'dist/cli.js');
  },
});
