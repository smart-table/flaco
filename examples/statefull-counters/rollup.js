import resolve from 'rollup-plugin-node-resolve';

export default {
    input: './examples/statefull-counters/index.js',
    output: [{
        format: 'iife',
        name: 'example',
        file: './examples/statefull-counters/statefull-counters.js',
        sourcemap: true
    }],
    plugins: [resolve()]
};
