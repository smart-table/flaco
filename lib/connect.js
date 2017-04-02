import update from './update';
import {compose, curry} from 'smart-table-operators';
import {onMount, onUnMount} from './lifeCycles'
import {isDeepEqual, identity} from './util';

/**
 * Connect combinator: will create "container" component which will subscribe to a Redux like store. and update its children whenever a specific slice of state change
 */
export default function (store, actions = {}, sliceState = identity) {
  return function (comp, mapStateToProp = identity, shouldUpate = (a, b) => !isDeepEqual(a, b)) {
    return function (initProp) {
      let updateFunc;
      let previousStateSlice;
      let componentProps = initProp;
      let unsubscriber;

      const wrapperComp = (props, ...args) => {
        return comp(props, actions, ...args);
      };

      const subscribe = onMount((vnode) => {
        updateFunc = update(wrapperComp, vnode);
        unsubscriber = store.subscribe(() => {
          const stateSlice = sliceState(store.getState());
          if (shouldUpate(previousStateSlice, stateSlice)) {
            Object.assign(componentProps, mapStateToProp(stateSlice));
            updateFunc(componentProps);
            previousStateSlice = stateSlice;
          }
        });
      });

      const unsubscribe = onUnMount(() => {
        unsubscriber();
      });

      return compose(subscribe, unsubscribe)(wrapperComp);
    };
  };
};