import {curry, compose} from 'smart-table-operators';
import {ComponentFunction, VNode} from './h';

export enum LifeCycles {
    onMount = 'onMount',
    onUnMount = 'onUnMount',
    onUpdate = 'onUpdate'
}

export interface LifecycleCallback {
    (node: VNode, ...args: any[]): void;
}

const lifeCycleFactory = (method: LifeCycles) => curry((fn: LifecycleCallback, comp: ComponentFunction) => (props: object, ...args: any[]): VNode => {
    const n = comp(props, ...args);
    const applyFn = () => fn(n, ...args);
    const current = n[method];
    n[method] = current ? compose(current, applyFn) : applyFn; // allow multiple hooks;
    return n;
});

export const onMount = lifeCycleFactory(LifeCycles.onMount);
export const onUnMount = lifeCycleFactory(LifeCycles.onUnMount);
export const onUpdate = lifeCycleFactory(LifeCycles.onUpdate);
