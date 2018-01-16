import {compose} from 'smart-table-operators';
import update from './update';
import {onMount} from './lifecycles';

/**
 * Combinator to create a Elm like app
 * @param view {Function} - a component which takes as arguments the current model and the list of updates
 * @returns {Function} - a Elm like application whose properties "model", "updates" and "subscriptions" will define the related domain specific objects
 */
export default view => ({model, updates, subscriptions = []} = {}) => {
	let updateFunc;
	const actionStore = {};
	for (const update of Object.keys(updates)) {
		actionStore[update] = () => updateFunc(model, actionStore);
	}

	const comp = () => view(model, actionStore);

	const initActionStore = vnode => {
		updateFunc = update(comp, vnode);
	};
	const initSubscription = subscriptions.map(sub => vnode => sub(vnode, actionStore));
	const initFunc = compose(initActionStore, ...initSubscription);

	return onMount(initFunc, comp);
};
