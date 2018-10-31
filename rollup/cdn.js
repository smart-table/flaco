import resolve from 'rollup-plugin-node-resolve';

export default {
    input: './dist/src/index.js',
    output: [{
        format: 'iife',
        name: 'Flaco',
        file: './dist/bundle/flaco.js',
        sourcemap: true
    }, {
        format: 'es',
        file: './dist/bundle/flaco.es.js',
        sourcemap: true
    }],
    plugins: [resolve()]
};
