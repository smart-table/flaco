import update from './update';
import {onMount} from './lifeCycles';

/**
 * Combinator to create a "stateful component": ie it will have its own state
 * @param comp
 * @returns {Function}
 */
export default function (comp) {
  return function () {
    let updateFunc;
    const wrapperComp = (props, ...args) => {
      // wrap the function call when the component has not been mounted yet (lazy evaluation to make sure the updateFunc has been set);
      const setState = updateFunc ? updateFunc : (newState) => updateFunc(newState);
      return comp(props, setState, ...args);
    };

    return onMount((vnode) => {
      updateFunc = update(wrapperComp, vnode);
    }, wrapperComp);
  };
}