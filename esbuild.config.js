const esbuild = require('esbuild');

const buildOptions = {
  entryPoints: ['index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node14',
  outfile: 'dist/p-ipc.js',
  minify: true,
  treeShaking: true,
  external: ['node-ipc', 'bson', 'uniqid'],
  format: 'cjs',
  sourcemap: true,
};

esbuild.build(buildOptions).catch(() => process.exit(1));
