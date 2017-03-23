import update from './update';
import {onMount} from './lifeCycles';
import {compose} from 'smart-table-operators';

/**
 * Combinator to create a Elm like app
 * @param view
 */
export default function (view) {

  return function ({model, updates, subscriptions = []}) {
    let actionStore = {};

    const comp = props => view(model, actionStore);

    const initActionStore = (vnode) => {
      const updateFunc = update(comp, vnode);
      for (let update of Object.keys(updates)) {
        actionStore[update] = (...args) => {
          model = updates[update](model, ...args); //todo consider side effects, middlewares, etc
          return updateFunc(model, actionStore);
        }
      }
    };
    const initSubscription = subscriptions.map(sub => vnode => sub(vnode, actionStore));
    const initFunc = compose(initActionStore, ...initSubscription);

    return onMount(initFunc, comp);
  };
};