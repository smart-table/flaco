import {tap} from 'smart-table-operators';
import {VNode} from './h';

const SVG_NP = 'http://www.w3.org/2000/svg';

enum EventSubscriptionMethod {
    removeEventListener = 'removeEventListener',
    addEventListener = 'addEventListener'
}

export type AttributePair = [string, any];

const updateDomNodeFactory = (method: EventSubscriptionMethod) => (items) =>
    tap(domNode => {
        for (const pair of items) {
            domNode[method](...pair);
        }
    });

export const removeEventListeners = updateDomNodeFactory(EventSubscriptionMethod.removeEventListener);

export const addEventListeners = updateDomNodeFactory(EventSubscriptionMethod.addEventListener);

export const setAttributes = (attributePairs: AttributePair[]) => tap((dom: Element) => {
    const attributes = attributePairs.filter(([key, value]) => typeof value !== 'function');
    for (const [key, value] of attributes) {
        if (value === false) {
            dom.removeAttribute(key);
        } else {
            dom.setAttribute(key, value);
        }
    }
});

export const removeAttributes = (attributes: string[]) => tap((dom: Element) => {
    for (const attr of attributes) {
        dom.removeAttribute(attr);
    }
});

export const setTextNode = (val: any) => (node: Node) => {
    node.textContent = val;
};

export const createDomNode = (vnode: VNode, parent: Element): Element | Node => {
    if (vnode.nodeType === 'svg') {
        return document.createElementNS(SVG_NP, vnode.nodeType);
    } else if (vnode.nodeType === 'Text') {
        return document.createTextNode(vnode.nodeType);
    }
    return parent.namespaceURI === SVG_NP ?
        document.createElementNS(SVG_NP, vnode.nodeType) :
        document.createElement(vnode.nodeType);
};

// @ts-ignore
export const getEventListeners = (props: object): AttributePair[] => Object.keys(props)
    .filter(k => k.substr(0, 2) === 'on')
    .map(k => [k.substr(2).toLowerCase(), props[k]]);
