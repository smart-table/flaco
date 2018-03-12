import node from 'rollup-plugin-node-resolve';

export default {
	input: './index.js',
	output: [{
		file: './dist/flaco.js',
		format: 'umd',
		name: 'flaco'
	}],
	plugins: [node({jsnext:true})]
};