import update from './update';
import {onMount} from './lifeCycles';
import {compose} from 'smart-table-operators';

/**
 * Combinator to create a Elm like app
 * @param view {Function} - a component which takes as arguments the current model and the list of updates
 * @returns {Function} - a Elm like application whose properties "model", "updates" and "subscriptions" will define the related domain specific objects
 */
export default function (view) {
  return function ({model, updates, subscriptions = []}={}) {
    let updateFunc;
    let actionStore = {};
    for (let update of Object.keys(updates)) {
      actionStore[update] = (...args) => {
        model = updates[update](model, ...args); //todo consider side effects, middlewares, etc
        return updateFunc(model, actionStore);
      }
    }

    const comp = () => view(model, actionStore);

    const initActionStore = (vnode) => {
      updateFunc = update(comp, vnode);
    };
    const initSubscription = subscriptions.map(sub => vnode => sub(vnode, actionStore));
    const initFunc = compose(initActionStore, ...initSubscription);

    return onMount(initFunc, comp);
  };
};