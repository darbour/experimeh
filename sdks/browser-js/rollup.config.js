import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';
import pkg from './package.json';

const input = 'src/index.ts';

const external = [
  ...Object.keys(pkg.dependencies || {}),
  ...Object.keys(pkg.peerDependencies || {}),
];

const plugins = [
  resolve(),
  commonjs(),
  typescript({
    tsconfig: './tsconfig.json',
    declaration: true,
    declarationDir: './dist',
  }),
];

export default [
  // UMD build for browsers
  {
    input,
    output: {
      name: 'Experimeh',
      file: pkg.browser,
      format: 'umd',
      sourcemap: true,
      globals: {},
    },
    plugins: [...plugins, terser()],
  },

  // UMD non-minified
  {
    input,
    output: {
      name: 'Experimeh',
      file: pkg.browser.replace('.js', '.development.js'),
      format: 'umd',
      sourcemap: true,
      globals: {},
    },
    plugins,
  },

  // CommonJS build
  {
    input,
    external,
    output: {
      file: pkg.main,
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    plugins,
  },

  // ES Module build
  {
    input,
    external,
    output: {
      file: pkg.module,
      format: 'es',
      sourcemap: true,
    },
    plugins,
  },
];
