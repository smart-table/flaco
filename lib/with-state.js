import {compose} from 'smart-table-operators';
import update from './update';
import {onMount, onUpdate} from './lifecycles';

/**
 * Combinator to create a "stateful component": ie it will have its own state and the ability to update its own tree
 * @param comp {Function} - the component
 * @returns {Function} - a new wrapped component
 */
export default comp => () => {
	let updateFunc;
	// Lazy evaluate updateFunc (to make sure it is defined
	const wrapperComp = (props, ...args) => comp(props, newState => updateFunc(newState), ...args);

	const setUpdateFunction = vnode => {
		updateFunc = update(wrapperComp, vnode);
	};

	return compose(onMount(setUpdateFunction), onUpdate(setUpdateFunction))(wrapperComp);
};
