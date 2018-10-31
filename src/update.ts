import {render} from './dom-renderer';
import {onNextTick} from './util';
import {ComponentFunction, VNode} from './h';

export const update = (comp: ComponentFunction, initialVNode: VNode) => {
    let oldNode = initialVNode;
    return (props: object, ...args: any[]) => {
        const mountNode = <Element>oldNode.dom.parentNode;
        const newNode = comp({...oldNode.props, ...props}, ...args);
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
