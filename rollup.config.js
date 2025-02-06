// filepath: rollup.config.js
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';

export default {
  input: 'src/index.ts', // Entry point of your library
  output: [
    {
      file: 'dist/bundle.cjs.js',
      format: 'cjs', // CommonJS format for Node.js
      sourcemap: true,
    },
    {
      file: 'dist/bundle.esm.js',
      format: 'esm', // ES module format for modern browsers
      sourcemap: true,
    },
    {
      file: 'dist/bundle.umd.js',
      format: 'umd', // UMD format for both Node.js and browsers
      name: 'MyLibrary', // Global variable name for UMD build
      sourcemap: true,
    },
  ],
  plugins: [
    resolve(), // Resolve node_modules
    commonjs(), // Convert CommonJS modules to ES6
    typescript(), // Compile TypeScript
  ],
};