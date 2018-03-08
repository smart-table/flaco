import node from 'rollup-plugin-node-resolve';
import babel from 'rollup-plugin-babel';
import replace from 'rollup-plugin-replace';
import cjs from 'rollup-plugin-commonjs';

export default {
	input: './test/index.js',
	output: {
		file: './test/dist/bundle.js',
		format: 'iife',
		name: 'test',
		sourcemap: true
	},
	plugins: [
		replace({'process.env.NODE_ENV': JSON.stringify('dev')}),
		node({jsnext: true}),
		babel({plugins: [['transform-react-jsx', {pragma: 'h'}]]}),
		cjs()
	]
};