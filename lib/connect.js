import update from './update';

/**
 * Connect combinator: will create "container" component which will subscribe to a Redux like store. and update its children whenever a specific slice of a component change
 */
export default function (comp) {
  return function ({store}) {
    let actionStore = {};
    const initActionStore = vnode => {

    }
  };
};