import buble from 'rollup-plugin-buble';
import node from 'rollup-plugin-node-resolve';
import replace from 'rollup-plugin-replace';

export default {
  entry: "./index.js",
  plugins: [
    replace({"from './traverse'": "from './traverse.legacy'"}),
    node({jsnext: true}),
    buble({
      jsx: 'h',
      transforms: {dangerousForOf: true},
      target: {
        safari: 9,
        ie: 11
      }
    })
  ],
  dest: "./dist/flaco.legacy.js",
  moduleName: "flaco",
  format: "umd",
  sourceMap: true
};