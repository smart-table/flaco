export const upsertChild = (parentNode, newChild, oldChild) => {
  return oldChild ? parentNode.replaceChild(newChild, oldChild) : parentNode.appendChild(newChild);
};

export const removeAttributes = (...attributes) => (domNode) => {
  for (let attr of attributes) {
    domNode.removeAttribute(attr);
  }
  return domNode;
};

export const removeEventListeners = (...listeners) => (domNode) => {
  for (let [event, listener] of listeners) {
    domNode.removeEventListener(event, listener);
  }
  return domNode;
};

export const addEventListeners = (...listeners) => (domNode) => {
  for (let [event, listener] of listeners) {
    domNode.addEventListener(event, listener);
  }
  return domNode;
};

export const setAttributes = (...pairs) => (domNode) => {
  const attributes = pairs.filter(p => typeof p[1] !== 'function' && typeof p[1] !== 'object');
  for (let [attr, value] of attributes) {
    domNode.setAttribute(attr, value);
  }
  return domNode;
};

export const setTextNode = val => node => node.textContent = val;

export const createDomNode = vnode => {
  return vnode.nodeType === 'Text' ?
    document.createTextNode(String(vnode.props.value)) :
    document.createElement(vnode.nodeType);
};

export const isShallowEqual = (a, b) => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((k) => a[k] === b[k]);
};
