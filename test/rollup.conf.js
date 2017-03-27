import buble from 'rollup-plugin-buble';
import node from 'rollup-plugin-node-resolve';

export default {
  entry: "./test/browser/index.js",
  plugins: [
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