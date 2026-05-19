import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import postcss from 'rollup-plugin-postcss';

const isProd = process.env.BUILD === 'production';

export default {
  input: 'src/index.js',
  output: [
    {
      file: 'dist/reih-widget.js',
      format: 'iife',
      name: 'ReihWidget',
      sourcemap: !isProd,
    },
    {
      file: 'dist/reih-widget.esm.js',
      format: 'es',
      sourcemap: !isProd,
    },
  ],
  plugins: [
    replace({
      preventAssignment: true,
      'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
    }),
    postcss({
      inject: false,
      extract: false,
      minimize: isProd,
    }),
    resolve({
      extensions: ['.js', '.jsx'],
    }),
    commonjs(),
    babel({
      babelHelpers: 'bundled',
      presets: [],
      plugins: [
        ['@babel/plugin-transform-react-jsx', { pragma: 'h', pragmaFrag: 'Fragment' }],
      ],
      extensions: ['.js', '.jsx'],
    }),
    isProd && terser({
      compress: { passes: 2 },
    }),
  ].filter(Boolean),
};
