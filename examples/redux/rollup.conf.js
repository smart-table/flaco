import buble from 'rollup-plugin-buble';
import node from 'rollup-plugin-node-resolve';
import replace from 'rollup-plugin-replace';

export default {
  entry: "./examples/redux/index.js",
  plugins: [
    replace({'process.env.NODE_ENV': JSON.stringify('dev')}),
    node({jsnext: true}),
    buble({
      jsx: 'h',
      target: {chrome: 52},
      objectAssign: 'Object.assign'
    })
  ],
  dest: "./examples/redux/bundle.js",
  moduleName: "redux",
  format: "iife",
  sourceMap: 'inline'
};
