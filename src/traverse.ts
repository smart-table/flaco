import {VNode} from './h';

export function* traverse(vnode: VNode) {
    yield vnode;
    if (vnode.children.length > 0) {
        for (const child of vnode.children) {
            yield* traverse(child);
        }
    }
}
