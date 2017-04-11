import update from './update';
import {onMount} from './lifeCycles';
import {compose} from 'smart-table-operators';

//todo throw this in favor of connect only ?

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