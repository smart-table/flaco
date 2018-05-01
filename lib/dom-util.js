import {tap} from 'smart-table-operators';

const SVG_NP = 'http://www.w3.org/2000/svg';

const updateDomNodeFactory = method => items => tap(domNode => {
	for (const pair of items) {
		domNode[method](...pair);
	}
});

export const removeEventListeners = updateDomNodeFactory('removeEventListener');

export const addEventListeners = updateDomNodeFactory('addEventListener');

export const setAttributes = items => tap(domNode => {
	const attributes = items.filter(([key, value]) => typeof value !== 'function');
	for (const [key, value] of attributes) {
		if (value === false) {
			domNode.removeAttribute(key);
		} else {
			domNode.setAttribute(key, value);
		}
	}
});

export const removeAttributes = items => tap(domNode => {
	for (const attr of items) {
		domNode.removeAttribute(attr);
	}
});

export const setTextNode = val => node => {
	node.textContent = val;
};

export const createDomNode = (vnode, parent) => {
	if (vnode.nodeType === 'svg') {
		return document.createElementNS(SVG_NP, vnode.nodeType);
	} else if (vnode.nodeType === 'Text') {
		return document.createTextNode(vnode.nodeType);
	}
	return parent.namespaceURI === SVG_NP ?
		document.createElementNS(SVG_NP, vnode.nodeType) :
		document.createElement(vnode.nodeType);
};

export const getEventListeners = props => Object.keys(props)
	.filter(k => k.substr(0, 2) === 'on')
	.map(k => [k.substr(2).toLowerCase(), props[k]]);
