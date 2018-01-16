import zora from 'zora';
import util from './util';
import domUtil from './dom-util';
import h from './h';
import lifecycles from './lifecycles';
import render from './render';
import update from './update'
import withState from './with-state';
import connect from './connect';

export default zora()
	.test(util)
	.test(domUtil)
	.test(h)
	.test(lifecycles)
	.test(render)
	.test(update)
	.test(withState)
	.test(connect)
	.run();
