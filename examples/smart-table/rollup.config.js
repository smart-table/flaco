import buble from 'rollup-plugin-buble';
import node from 'rollup-plugin-node-resolve';

export default {
  entry: "./examples/smart-table/index.js",
  plugins: [
    node({jsnext: true}),
    buble({
      jsx: 'h',
      target: {chrome: 52},
      objectAssign: 'Object.assign'
    })
  ],
  dest: "./bundle.js",
  moduleName: "smartTable",
  format: "iife",
  sourceMap: 'inline'
};
