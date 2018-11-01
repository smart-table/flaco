import resolve from 'rollup-plugin-node-resolve';

export default {
    input: [
        './examples/statefull-counters/statefull-counters.js',
        './examples/hello-world/hello-world.js',
        './examples/central-store/central-store.js',
        './examples/timer/timer.js',
        './examples/smart-table/smart-table.js'
    ],
    output: [{
        dir: './examples/dist',
        format: 'es',
        sourcemap: true
    }],
    plugins: [resolve()],
    experimentalCodeSplitting: true,
};
