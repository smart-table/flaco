import node from 'rollup-plugin-node-resolve';
import cjs from 'rollup-plugin-commonjs';

export default {
    input: './test/index.js',
    output: {
        file: './test/dist/debug.js',
        format: 'iife',
        name: 'test',
        sourcemap:true
    },
    plugins: [node({module:true}), cjs()]
};
