import buble from 'rollup-plugin-buble';
import node from 'rollup-plugin-node-resolve';

export default {
  entry: "./examples/benchmark-elm-like-app/index.js",
  plugins: [
    node({jsnext: true}),
    buble({
      jsx: 'h',
      target: {chrome: 52}
    })
  ],
  dest: "./examples/benchmark-elm-like-app/dist/index.js",
  moduleName: "benchmark",
  format: "iife",
  sourceMap: 'inline'
};
