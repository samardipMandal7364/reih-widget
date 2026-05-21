import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import babel from '@rollup/plugin-babel';
import replace from '@rollup/plugin-replace';
import terser from '@rollup/plugin-terser';
import postcss from 'rollup-plugin-postcss';

const isProd = process.env.BUILD === 'production';

function createPlugins() {
  return [
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
  ].filter(Boolean);
}

export default [
  {
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
    plugins: createPlugins(),
  },
  {
    input: 'src/v4-demo.js',
    output: {
      file: 'dist/v4-studio.js',
      format: 'iife',
      name: 'ReihV4Studio',
      sourcemap: !isProd,
    },
    plugins: createPlugins(),
  },
];
