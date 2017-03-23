import buble from 'rollup-plugin-buble';
import node from 'rollup-plugin-node-resolve';

export default {
  entry: "./examples/index.js",
  plugins: [
    node({jsnext:true}),
    buble({
      jsx: 'h',
      target:{chrome:52}
    })
  ],
  dest: "./examples/bundle.js",
  moduleName: "bundle",
  format: "iife",
  sourceMap: 'inline'
};