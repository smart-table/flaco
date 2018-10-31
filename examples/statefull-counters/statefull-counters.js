(function () {
    'use strict';

    const onNextTick = (fn) => setTimeout(fn, 0);
    const pairify = (holder) => (key) => [key, holder[key]];
    const isShallowEqual = (a, b) => {
        const aKeys = Object.keys(a);
        const bKeys = Object.keys(b);
        return aKeys.length === bKeys.length && aKeys.every(k => a[k] === b[k]);
    };
    // no attributes
    const NA = Object.freeze({});
    const noop = () => {
    };
    const isVTextNode = (vnode) => vnode.nodeType === 'Text';
    const isVNode = (vnode) => typeof vnode !== 'function';

    const createTextVNode = (value) => ({
        nodeType: 'Text',
        children: [],
        props: { value },
        lifeCycle: 0
    });
    const normalize = (children, currentText = '', normalized = []) => {
        if (children.length === 0) {
            if (currentText) {
                normalized.push(createTextVNode(currentText));
            }
            return normalized;
        }
        const child = children.shift();
        const type = typeof child;
        if (type === 'object' || type === 'function') {
            if (currentText) {
                normalized.push(createTextVNode(currentText));
                currentText = '';
            }
            normalized.push(child);
        }
        else {
            currentText += child;
        }
        return normalize(children, currentText, normalized);
    };
    function h(nodeType, props, ...children) {
        const actualProps = props === null ? NA : props;
        const flatChildren = [];
        for (const c of children) {
            if (Array.isArray(c)) {
                flatChildren.push(...c);
            }
            else {
                flatChildren.push(c);
            }
        }
        const normalizedChildren = normalize(flatChildren);
        if (typeof nodeType !== 'function') { // Regular html/text node
            return {
                nodeType,
                props: actualProps,
                children: normalizedChildren,
                lifeCycle: 0
            };
        }
        const fullProps = Object.assign({ children: normalizedChildren }, actualProps);
        const comp = nodeType(fullProps);
        const compType = typeof comp;
        return compType !== 'function' ? comp : h(comp, actualProps, ...normalizedChildren); // Functional comp vs combinator (HOC)
    }

    const compose = (first, ...fns) => (...args) => fns.reduce((previous, current) => current(previous), first(...args));
    const curry = (fn, arityLeft) => {
        const arity = arityLeft || fn.length;
        return (...args) => {
            const argLength = args.length || 1;
            if (arity === argLength) {
                return fn(...args);
            }
            const func = (...moreArgs) => fn(...args, ...moreArgs);
            return curry(func, arity - args.length);
        };
    };
    const tap = (fn) => arg => {
        fn(arg);
        return arg;
    };

    const SVG_NP = 'http://www.w3.org/2000/svg';
    var EventSubscriptionMethod;
    (function (EventSubscriptionMethod) {
        EventSubscriptionMethod["removeEventListener"] = "removeEventListener";
        EventSubscriptionMethod["addEventListener"] = "addEventListener";
    })(EventSubscriptionMethod || (EventSubscriptionMethod = {}));
    const updateDomNodeFactory = (method) => (items) => tap(domNode => {
        for (const pair of items) {
            domNode[method](...pair);
        }
    });
    const removeEventListeners = updateDomNodeFactory(EventSubscriptionMethod.removeEventListener);
    const addEventListeners = updateDomNodeFactory(EventSubscriptionMethod.addEventListener);
    const setAttributes = (attributePairs) => tap((dom) => {
        const attributes = attributePairs.filter(([key, value]) => typeof value !== 'function');
        for (const [key, value] of attributes) {
            if (value === false) {
                dom.removeAttribute(key);
            }
            else {
                dom.setAttribute(key, value);
            }
        }
    });
    const removeAttributes = (attributes) => tap((dom) => {
        for (const attr of attributes) {
            dom.removeAttribute(attr);
        }
    });
    const setTextNode = (val) => (node) => {
        node.textContent = val;
    };
    const createDomNode = (vnode, parent) => {
        if (vnode.nodeType === 'svg') {
            return document.createElementNS(SVG_NP, vnode.nodeType);
        }
        else if (vnode.nodeType === 'Text') {
            return document.createTextNode(vnode.nodeType);
        }
        return parent.namespaceURI === SVG_NP ?
            document.createElementNS(SVG_NP, vnode.nodeType) :
            document.createElement(vnode.nodeType);
    };
    // @ts-ignore
    const getEventListeners = (props) => Object.keys(props)
        .filter(k => k.substr(0, 2) === 'on')
        .map(k => [k.substr(2).toLowerCase(), props[k]]);

    function* traverse(vnode) {
        yield vnode;
        if (vnode.children.length > 0) {
            for (const child of vnode.children) {
                yield* traverse(child);
            }
        }
    }

    var LifeCycles;
    (function (LifeCycles) {
        LifeCycles["onMount"] = "onMount";
        LifeCycles["onUnMount"] = "onUnMount";
        LifeCycles["onUpdate"] = "onUpdate";
    })(LifeCycles || (LifeCycles = {}));
    const lifeCycleFactory = (method) => curry((fn, comp) => (props, ...args) => {
        const n = comp(props, ...args);
        const applyFn = () => fn(n, ...args);
        const current = n[method];
        n[method] = current ? compose(current, applyFn) : applyFn; // allow multiple hooks;
        return n;
    });
    const onMount = lifeCycleFactory(LifeCycles.onMount);
    const onUnMount = lifeCycleFactory(LifeCycles.onUnMount);
    const onUpdate = lifeCycleFactory(LifeCycles.onUpdate);

    const updateEventListeners = (newNode, oldNode) => {
        const newNodeEvents = getEventListeners(newNode.props);
        const oldNodeEvents = getEventListeners(oldNode.props);
        return newNodeEvents.length || oldNodeEvents.length ?
            compose(removeEventListeners(oldNodeEvents), addEventListeners(newNodeEvents)) : noop;
    };
    const updateAttributes = (newVNode, oldVNode) => {
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
        return compose(removeAttributes(attributesToRemove), setAttributes(newNodeKeys.map(pairify(newVNodeProps))));
    };
    const domFactory = createDomNode;
    // Apply vnode diffing to actual dom node (if new node => it will be mounted into the parent)
    const domify = (oldVnode, newVnode, parentDomNode) => {
        if (oldVnode === null && newVnode) { // There is no previous vnode
            newVnode.dom = parentDomNode.appendChild(domFactory(newVnode, parentDomNode));
            newVnode.lifeCycle = 1;
            return { vnode: newVnode, garbage: null };
        }
        // There is a previous vnode
        if (newVnode === null) { // We must remove the related dom node
            parentDomNode.removeChild(oldVnode.dom);
            return ({ garbage: oldVnode, vnode: null });
        }
        else if (newVnode.nodeType !== oldVnode.nodeType) { // It must be replaced (todo check with keys)
            newVnode.dom = domFactory(newVnode, parentDomNode);
            newVnode.lifeCycle = 1;
            parentDomNode.replaceChild(newVnode.dom, oldVnode.dom);
            return { garbage: oldVnode, vnode: newVnode };
        }
        // Only update attributes
        newVnode.dom = oldVnode.dom;
        // Pass the unMountHook
        if (oldVnode.onUnMount) {
            newVnode.onUnMount = oldVnode.onUnMount;
        }
        newVnode.lifeCycle = oldVnode.lifeCycle + 1;
        return { garbage: null, vnode: newVnode };
    };
    const noNode = 'none';
    const falseNode = Object.freeze({
        nodeType: noNode,
        lifeCycle: -1,
        children: [],
        props: {}
    });
    const render = (oldVnode, newVnode, parentDomNode, nextBatchOperations = []) => {
        // 1. transform the new vnode to a vnode connected to an actual dom element based on vnode versions diffing
        // 	i. note at this step occur dom insertions/removals
        // 	ii. it may collect sub tree to be dropped (or "unmounted")
        const { vnode, garbage } = domify(oldVnode, newVnode, parentDomNode);
        if (garbage !== null) {
            // Defer unmount lifecycle as it is not "visual"
            for (const g of traverse(garbage)) {
                if (typeof g[LifeCycles.onUnMount] === 'function') {
                    nextBatchOperations.push(g.onUnMount);
                }
            }
        }
        // Normalisation of old node (in case of a replace we will consider old node as empty node (no children, no props))
        const tempOldNode = garbage !== null || !oldVnode ? falseNode : oldVnode;
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
                    render(tempOldNode.children[i] || null, vnode.children[i] || null, vnode.dom, nextBatchOperations);
                }
            }
        }
        return nextBatchOperations;
    };
    // todo
    const hydrate = (vnode, dom) => {
        const hydrated = Object.assign({}, vnode);
        const domChildren = Array.from(dom.childNodes).filter((n) => n.nodeType !== 3 || n.nodeValue.trim() !== '');
        hydrated.dom = dom;
        hydrated.children = vnode.children.map((child, i) => hydrate(child, domChildren[i]));
        return hydrated;
    };
    const mount = curry((comp, initProp, root) => {
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

    const update = (comp, initialVNode) => {
        let oldNode = initialVNode;
        return (props, ...args) => {
            const mountNode = oldNode.dom.parentNode;
            const newNode = comp(Object.assign({}, oldNode.props, props), ...args);
            const nextBatch = render(oldNode, newNode, mountNode);
            // Danger zone !!!!
            // Change by keeping the same reference so the eventual parent node does not need to be "aware" tree may have changed downstream:
            // oldNode may be the child of someone ...(well that is a tree data structure after all :P )
            oldNode = Object.assign(oldNode || {}, newNode);
            // End danger zone
            onNextTick(() => {
                for (const op of nextBatch) {
                    op();
                }
            });
            return newNode;
        };
    };

    const withState = (comp) => () => {
        let updateFunc;
        // Lazy evaluate updateFunc (to make sure it is defined)
        const wrapperComp = (props, ...args) => comp(props, newState => updateFunc(newState), ...args);
        const setUpdateFunction = (vnode) => {
            updateFunc = update(wrapperComp, vnode);
        };
        return compose(onMount(setUpdateFunction), onUpdate(setUpdateFunction))(wrapperComp);
    };
    const withIdempotentState = (comp) => {
        const instances = new Map();
        return ({ key }) => {
            if (instances.has(key)) {
                return instances.get(key);
            }
            let updateFunc;
            // Lazy evaluate updateFunc (to make sure it is defined)
            const wrapperComp = (props, ...args) => comp(props, newState => updateFunc(newState), ...args);
            const setUpdateFunction = (vnode) => {
                instances.set(key, vnode);
                updateFunc = update(wrapperComp, vnode);
            };
            return compose(onMount(setUpdateFunction), onUpdate(setUpdateFunction))(wrapperComp);
        };
    };

    // Interactive elements
    // todo

    const filterOutFunction = (props) => Object
        .entries(props || {})
        .filter(([key, value]) => typeof value !== 'function');
    const escapeHTML = s => String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    const renderAsString = curry((comp, initProp = {}) => {
        const vnode = isVNode(comp) ? comp : comp(initProp);
        const { nodeType, children, props } = vnode;
        const attributes = escapeHTML(filterOutFunction(props)
            .map(([key, value]) => typeof value === 'boolean' ? (value === true ? key : '') : `${key}="${value}"`)
            .join(' '));
        const childrenHtml = children !== void 0 && children.length > 0 ? children.map(ch => renderAsString(ch)()).join('') : '';
        return isVTextNode(vnode) ? escapeHTML(String(vnode.props.value)) : `<${nodeType}${attributes ? ` ${attributes}` : ''}>${childrenHtml}</${nodeType}>`;
    });

    const CounterView = ({ value = 0, increment, decrement }) => {
        return h("div", null,
            h("p", null,
                "The value is ",
                value),
            h("button", { onclick: increment }, "Increment"),
            h("button", { onclick: decrement }, "Decrement"));
    };
    // @ts-ignore
    const Counter = withIdempotentState(({ value = 0 }, update$$1) => {
        const increment = () => {
            console.log('foo');
            update$$1({ value: value + 1 });
        };
        const decrement = () => {
            console.log('bar');
            update$$1({ value: value - 1 });
        };
        return h(CounterView, { value: value, increment: increment, decrement: decrement });
    });
    const ContainerView = ({ onclick }) => {
        return h("div", null,
            "// @ts-ignore",
            h(Counter, { key: 1, value: 0 })
        // @ts-ignore
        ,
            "// @ts-ignore",
            h(Counter, { key: 2, value: 10 }),
            h("button", { onclick: onclick }, "Evil update"));
    };
    // @ts-ignore
    const Container = withState((props, update$$1) => {
        // @ts-ignore
        const onclick = () => update$$1({});
        // @ts-ignore
        return h(ContainerView, Object.assign({ onclick: onclick }, props));
    });
    const fragment1 = document.createDocumentFragment();
    const fragment2 = document.createDocumentFragment();
    const main$1 = document.getElementById('main');
    // @ts-ignore
    mount(h(Container, null), {}, main$1);
    // mount(<Counter value={10} />, {}, fragment2);
    // main.appendChild(fragment1);
    // main.appendChild(fragment2);

}());
//# sourceMappingURL=statefull-counters.js.map
