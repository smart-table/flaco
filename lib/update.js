import {render} from './tree';
import {nextTick} from './util';

/**
 * Create a function which will trigger an update of the component with the passed state
 * @param comp
 * @param initialVNode
 * @returns {function(*=, ...[*])}
 */
export default function update (comp, initialVNode) {
  let oldNode = initialVNode;
  const updateFunc = (props, ...args) => {
    const mount = oldNode.dom.parentNode;
    const newNode = comp(Object.assign({children: oldNode.children || []}, oldNode.props, props), ...args);
    const nextBatch = render(oldNode, newNode, mount);
    oldNode = newNode;
    nextTick(function () {
      while (nextBatch.length) {
        const op = nextBatch.shift();
        op();
      }
    });
    return newNode;
  };
  return updateFunc;
}