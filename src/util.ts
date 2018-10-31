import {AttributePair} from './dom-util';
import {ComponentFunction, VNode, VNodeLike, VTextNode} from './h';

export const onNextTick = (fn: Function) => setTimeout(fn, 0);

export const pairify = (holder: object) => (key: string): AttributePair => [key, holder[key]];

export const isShallowEqual = (a: object, b: object) => {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    return aKeys.length === bKeys.length && aKeys.every(k => a[k] === b[k]);
};

const ownKeys = (obj: object): string[] => Object.getOwnPropertyNames(obj);

export const isDeepEqual = (a: any, b: any) => {
    const type = typeof a;
    const typeB = typeof b;

    // Short path(s)
    if (a === b) {
        return true;
    }

    if (type !== typeB) {
        return false;
    }

    if (type !== 'object') {
        return a === b;
    }

    // Objects ...
    if (a === null || b === null) {
        return false;
    }

    if (Array.isArray(a)) {
        return a.length && b.length && a.every((item, i) => isDeepEqual(a[i], b[i]));
    }

    const aKeys = ownKeys(a);
    const bKeys = ownKeys(b);
    return aKeys.length === bKeys.length && aKeys.every(k => isDeepEqual(a[k], b[k]));
};

// no attributes
export const NA = Object.freeze({});

export const noop = () => {
};

export const isVTextNode = (vnode: VNode | VTextNode): vnode is VTextNode =>
    vnode.nodeType === 'Text';

export const isVNode = (vnode: VNode | ComponentFunction): vnode is VNode =>
    typeof vnode !== 'function';

type propsOrVNode = {
    nodeType?: string
};

export const isVNodeLike = (input: propsOrVNode | VNodeLike): input is VNodeLike =>
    !(typeof input === 'object' && input.nodeType === void 0);
