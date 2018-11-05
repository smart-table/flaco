import {NA} from './util';

export interface VNode {
    nodeType: string;
    children: VNode[];
    props: object;
    lifeCycle: number;
    onMount?: Function;
    onUnMount?: Function;
    onUpdate?: Function;
    dom?: Element | Node;
}

type VTextNodeProps = {
    value: string | boolean | number;
}

export interface VTextNode extends VNode {
    props: VTextNodeProps
}

export interface ComponentFunction {
    (props: object, ...args: any[]): VNode;
}

const createTextVNode = (value: string): VTextNode => ({
    nodeType: 'Text',
    children: [],
    props: {value},
    lifeCycle: 0
});

const normalize = (children: any[], currentText: string = '', normalized: VNode[] = []): VNode[] => {
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
    } else {
        currentText += child;
    }

    return normalize(children, currentText, normalized);
};

export type NodeType = string | Function;
export type VNodeLike = NodeType | VNode

export function h(nodeType: NodeType, props: object | null, ...children: VNodeLike[]): VNode {
    const actualProps = props === null ? NA : props;
    const flatChildren = [];
    for (const c of children) {
        if (Array.isArray(c)) {
            flatChildren.push(...c);
        } else {
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

    const fullProps = {children: normalizedChildren, ...actualProps};
    const comp = nodeType(fullProps);
    const compType = typeof comp;
    // Higher order function vs component function
    return compType !== 'function' ? comp : h(comp, actualProps, ...normalizedChildren); // Functional comp vs combinator (HOC)
}
