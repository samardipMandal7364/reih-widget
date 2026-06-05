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
  // ─── Loader: thin vanilla JS script (runs on tenant page) ─────────────────
  {
    input: 'src/loader.js',
    output: {
      file: 'dist/reih-loader.js',
      format: 'iife',
      name: 'ReihWidgetLoader',
      sourcemap: !isProd,
    },
    plugins: [
      replace({
        preventAssignment: true,
        'process.env.NODE_ENV': JSON.stringify(isProd ? 'production' : 'development'),
      }),
      isProd && terser({ compress: { passes: 2 } }),
    ].filter(Boolean),
  },

  // ─── Embed: Preact app (runs inside the iframe) ───────────────────────────
  {
    input: 'src/embed.js',
    output: {
      file: 'dist/reih-embed.js',
      format: 'iife',
      name: 'ReihWidgetEmbed',
      sourcemap: !isProd,
    },
    plugins: createPlugins(),
  },
];
