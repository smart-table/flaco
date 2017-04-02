import buble from 'rollup-plugin-buble';
import node from 'rollup-plugin-node-resolve';
import replace from 'rollup-plugin-replace';

export default {
  entry: "./examples/todomvc-redux/index.js",
  plugins: [
    replace({'process.env.NODE_ENV': JSON.stringify('dev')}),
    node({jsnext: true}),
    buble({
      jsx: 'h',
      target: {chrome: 52},
      objectAssign: 'Object.assign'
    })
  ],
  dest: "./examples/todomvc-redux/dist/bundle.js",
  moduleName: "smartTable",
  format: "iife",
  sourceMap: 'inline'
};
