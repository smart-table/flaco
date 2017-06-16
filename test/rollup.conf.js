import buble from 'rollup-plugin-buble';
import node from 'rollup-plugin-node-resolve';
import replace from 'rollup-plugin-replace';

export default {
  entry: "./test/index.js",
  plugins: [
    replace({'process.env.NODE_ENV': JSON.stringify('dev')}),
    node({jsnext: true}),
    buble({
      jsx: 'h',
      target: {chrome: 52}
    })
  ],
  dest: "./test/dist/bundle.js",
  moduleName: "test",
  format: "iife",
  sourceMap: 'inline'
};