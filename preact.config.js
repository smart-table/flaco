import buble from 'rollup-plugin-buble';
import node from 'rollup-plugin-node-resolve';

export default {
  entry: "./withPreact.js",
  plugins: [
    node({jsnext:true}),
    buble({
      target: {chrome: 52},
      jsx: 'h'
    })
  ],
  dest: "./bundle.js",
  moduleName: "bundle",
  format: "iife",
  sourceMap: 'inline'
};