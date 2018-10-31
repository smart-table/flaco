import {compose, curry} from 'smart-table-operators';
import {
    isShallowEqual,
    pairify,
    onNextTick,
    noop, isVTextNode, isVNode
} from './util';
import {
    removeAttributes,
    setAttributes,
    setTextNode,
    createDomNode,
    removeEventListeners,
    addEventListeners,
    getEventListeners
} from './dom-util';
import {traverse} from './traverse';
import {ComponentFunction, VNode} from './h';
import {LifeCycles} from './lifecycles';

const updateEventListeners = (newNode: VNode, oldNode: VNode) => {
    const newNodeEvents = getEventListeners(newNode.props);
    const oldNodeEvents = getEventListeners(oldNode.props);

    return newNodeEvents.length || oldNodeEvents.length ?
        compose(
            removeEventListeners(oldNodeEvents),
            addEventListeners(newNodeEvents)
        ) : noop;
};

const updateAttributes = (newVNode: VNode, oldVNode: VNode) => {
    const newVNodeProps = newVNode.props;
    const oldVNodeProps = oldVNode.props;

    if (isShallowEqual(newVNodeProps, oldVNodeProps)) {
        return noop;
    }

    if (isVTextNode(newVNode)) {
        return setTextNode(newVNode.props.value);
    }

    const newNodeKeys = Object.keys(newVNodeProps);
    const oldNodeKeys = Object.keys(oldVNodeProps);
    const attributesToRemove = oldNodeKeys.filter(k => !newNodeKeys.includes(k));

    return compose(
        removeAttributes(attributesToRemove),
        setAttributes(newNodeKeys.map(pairify(newVNodeProps)))
    );
};

const domFactory = createDomNode;

interface PatchResult {
    vnode: VNode | null;
    garbage: VNode | null;
}

// Apply vnode diffing to actual dom node (if new node => it will be mounted into the parent)
const domify = (oldVnode: VNode | null, newVnode: VNode | null, parentDomNode: Element): PatchResult => {
    if (oldVnode === null && newVnode) { // There is no previous vnode
        newVnode.dom = parentDomNode.appendChild(domFactory(newVnode, parentDomNode));
        newVnode.lifeCycle = 1;
        return {vnode: newVnode, garbage: null};
    }

    // There is a previous vnode
    if (newVnode === null) { // We must remove the related dom node
        parentDomNode.removeChild(oldVnode.dom);
        return ({garbage: oldVnode, vnode: null});
    } else if (newVnode.nodeType !== oldVnode.nodeType) { // It must be replaced (todo check with keys)
        newVnode.dom = domFactory(newVnode, parentDomNode);
        newVnode.lifeCycle = 1;
        parentDomNode.replaceChild(newVnode.dom, oldVnode.dom);
        return {garbage: oldVnode, vnode: newVnode};
    }

    // Only update attributes
    newVnode.dom = oldVnode.dom;
    // Pass the unMountHook
    if (oldVnode.onUnMount) {
        newVnode.onUnMount = oldVnode.onUnMount;
    }
    newVnode.lifeCycle = oldVnode.lifeCycle + 1;
    return {garbage: null, vnode: newVnode};
};

const noNode = 'none';
const falseNode = Object.freeze({
    nodeType: noNode,
    lifeCycle: -1,
    children: [],
    props: {}
});

export const render = (oldVnode: VNode | null, newVnode: VNode | null, parentDomNode: Element, nextBatchOperations: Function[] = []) => {
    // 1. transform the new vnode to a vnode connected to an actual dom element based on vnode versions diffing
    // 	i. note at this step occur dom insertions/removals
    // 	ii. it may collect sub tree to be dropped (or "unmounted")
    const {vnode, garbage} = domify(oldVnode, newVnode, parentDomNode);

    if (garbage !== null) {
        // Defer unmount lifecycle as it is not "visual"
        for (const g of traverse(garbage)) {
            if (typeof g[LifeCycles.onUnMount] === 'function') {
                nextBatchOperations.push(g.onUnMount);
            }
        }
    }

    // Normalisation of old node (in case of a replace we will consider old node as empty node (no children, no props))
    const tempOldNode: VNode = garbage !== null || !oldVnode ? falseNode : oldVnode;

    if (vnode !== null) {
        // 2. update dom attributes based on vnode prop diffing.
        // Sync
        if (typeof vnode[LifeCycles.onUpdate] === 'function' && vnode.lifeCycle > 1) {
            vnode.onUpdate();
        }

        updateAttributes(vnode, tempOldNode)(vnode.dom);

        // Fast path
        if (vnode.nodeType === 'Text') {
            return nextBatchOperations;
        }

        if (typeof vnode.onMount === 'function' && vnode.lifeCycle === 1) {
            nextBatchOperations.push(() => vnode.onMount());
        }

        const childrenCount = Math.max(tempOldNode.children.length, vnode.children.length);

        // Async will be deferred as it is not "visual"
        const setListeners = updateEventListeners(vnode, tempOldNode);
        if (setListeners !== noop) {
            nextBatchOperations.push(() => setListeners(vnode.dom));
        }

        // 3. recursively traverse children to update dom and collect functions to process on next tick
        if (childrenCount > 0) {
            for (let i = 0; i < childrenCount; i++) {
                // We pass nextBatchOperations as reference (improve perf: memory + speed)
                render(tempOldNode.children[i] || null, vnode.children[i] || null, <Element>vnode.dom, nextBatchOperations);
            }
        }
    }

    return nextBatchOperations;
};

// todo
export const hydrate = (vnode, dom) => {
    const hydrated = Object.assign({}, vnode);
    const domChildren = Array.from(dom.childNodes).filter((n: Node) => n.nodeType !== 3 || n.nodeValue.trim() !== '');
    hydrated.dom = dom;
    hydrated.children = vnode.children.map((child, i) => hydrate(child, domChildren[i]));
    return hydrated;
};

export const mount = curry((comp: VNode | ComponentFunction, initProp: object, root: Element) => {
    const vnode = isVNode(comp) ? comp : comp(initProp || {});
    const oldVNode = root.children.length ? hydrate(vnode, root.children[0]) : null;
    const batch = render(oldVNode, vnode, root);
    onNextTick(() => {
        for (const op of batch) {
            op();
        }
    });
    return vnode;
});
