import buble from 'rollup-plugin-buble';
import node from 'rollup-plugin-node-resolve';

export default {
  entry: "./index.js",
  plugins: [
    node({jsnext: true}),
    buble({
      jsx: 'h',
      target: {chrome: 52}
    })
  ],
  dest: "./dist/flaco.js",
  moduleName: "flaco",
  format: "umd",
  sourceMap: true
};