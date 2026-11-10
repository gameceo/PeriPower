import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
export default {
  input: 'src/plugin.ts',
  output: { file: 'com.gameceo.peripower.sdPlugin/bin/plugin.js', format: 'es', sourcemap: true },
  external: [/^node:/, 'buffer', 'events', 'stream', 'http', 'https', 'net', 'tls', 'crypto', 'url', 'zlib', 'util'],
  plugins: [resolve({ preferBuiltins: true }), commonjs(), typescript({ include: ['src/**/*.ts'] })]
};
