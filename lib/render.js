import {compose} from 'smart-table-operators';
import {
  upsertChild,
  removeAttributes,
  setAttributes,
  isShallowEqual,
  setTextNode,
  createDomNode,
  removeEventListeners,
  addEventListeners

} from './util';

//the domNode parent of the eventual childNode represented by a virtual node.
// oldNode being the old version of the virtual node, newNode the current version
function toDom (parentDom, oldNode, newNode, domFactory) {
  let domNode;
  let garbage = null;
  if (newNode) {
    if (!oldNode || oldNode.nodeType !== newNode.nodeType) {
      domNode = domFactory(newNode);
      const diff = upsertChild(parentDom, domNode, oldNode && oldNode.dom) || null;
      garbage = oldNode && diff === oldNode.dom ? oldNode : null;
      newNode.dom = domNode;
    }
    newNode.dom = newNode.dom || oldNode.dom;
  } else if (oldNode) {
    parentDom.removeChild(oldNode.dom);
    garbage = oldNode;
  }
  return newNode ? {domNode: newNode.dom, garbage} : {garbage};
}

//return a function operating on DOM nodes based on vnode props diffing
function updateAttributes (newVNode, oldVNode) {
  const newVNodeProps = newVNode.props || {};
  const oldVNodeProps = oldVNode.props || {};
  const newNodeEvents = newVNode.events || {};
  const oldNodeEvents = oldVNode.events || {};

  if (isShallowEqual(newVNodeProps, oldVNodeProps)) {
    return () => {/* do nothing */
    };
  }

  if (newVNode.nodeType === 'Text') {
    return setTextNode(newVNode.props.value);
  }

  const newNodeKeys = Object.keys(newVNodeProps);
  const oldNodeKeys = Object.keys(oldVNodeProps);
  const toRemove = oldNodeKeys.filter(k => !newNodeKeys.includes(k));

  const pairify = holder => key => [key, holder[key]];

  return compose(
    removeEventListeners(...Object.keys(oldNodeEvents).map(pairify(oldNodeEvents))),
    removeAttributes(...toRemove),
    setAttributes(...newNodeKeys.map(pairify(newVNodeProps))),
    addEventListeners(...Object.keys(newNodeEvents).map(pairify(newNodeEvents)))
  );
}

// update a dom node and its descendant based on its virtual node representation
// oldNode being the old version of the virtual node, newNode the current version
export function updateTree (parentDom, oldNode, newNode, domFactory = createDomNode) {

  let garbageCollector = [];
  const tempOldNode = oldNode ? oldNode : {length: 0, children: []};

  //1. get the actual dom element related to virtual dom diff && collect node to remove/clean
  const {domNode, garbage} = toDom(parentDom, oldNode, newNode, domFactory);

  if (garbage !== null) {
    garbageCollector.push(garbage);
  }

  //2. update attributes
  if (domNode) {
    const updateFunc = updateAttributes(newNode, tempOldNode);
    updateFunc(domNode);

    //3 recursively do the same for children
    for (let i = 0; i < Math.max(tempOldNode.length, newNode.length); i++) {
      garbageCollector = garbageCollector.concat(updateTree(domNode, tempOldNode.children[i], newNode.children[i], domFactory));
    }
  }

  return garbageCollector;
}