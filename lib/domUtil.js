import {tap, compose} from 'smart-table-operators';

const updateDomNodeFactory = (method) => (listeners) => tap(domNode => {
  for (let pair of listeners) {
    domNode[method](...pair);
  }
});

export const removeAttributes = updateDomNodeFactory('removeAttribute');
export const removeEventListeners = updateDomNodeFactory('removeEventListener');
export const addEventListeners = updateDomNodeFactory('addEventListener');
export const setAttributes = compose(
  pairs => pairs.filter(([key, value]) => typeof value !== 'function'), //only keep primitives
  updateDomNodeFactory('setAttribute')
);

export const setTextNode = val => node => node.textContent = val;

export const createDomNode = vnode => {
  return vnode.nodeType !== 'Text' ?
    document.createElement(vnode.nodeType) :
    document.createTextNode(String(vnode.props.value));
};

export const getEventListeners = (props) => {
  return Object.keys(props).filter(k => k.substr(0, 2) === 'on')
    .map(k => [k.substr(2).toLowerCase(), props[k]]);
};
