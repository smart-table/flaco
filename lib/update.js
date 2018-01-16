import {render} from './tree';
import {nextTick} from './util';

/**
 * Create a function which will trigger an update of the component with the passed state
 * @param comp {Function} - the component to update
 * @param initialVNode - the initial virtual dom node related to the component (ie once it has been mounted)
 * @returns {Function} - the update function
 */
export default (comp, initialVNode) => {
	let oldNode = initialVNode;
	return (props, ...args) => {
		const mount = oldNode.dom.parentNode;
		const newNode = comp(Object.assign({children: oldNode.children || []}, oldNode.props, props), ...args);
		const nextBatch = render(oldNode, newNode, mount);

		// Danger zone !!!!
		// Change by keeping the same reference so the eventual parent node does not need to be "aware" tree may have changed downstream: oldNode may be the child of someone ...(well that is a tree data structure after all :P )
		oldNode = Object.assign(oldNode || {}, newNode);
		// End danger zone

		nextTick(() => {
			for (const op of nextBatch) {
				op();
			}
		});

		return newNode;
	};
};
