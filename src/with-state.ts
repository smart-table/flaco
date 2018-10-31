import {compose} from 'smart-table-operators';
import {update} from './update';
import {onMount, onUpdate} from './lifecycles';
import {ComponentFunction, VNode} from './h';

export const withState = (comp: ComponentFunction) => (): ComponentFunction => {
    let updateFunc;
    // Lazy evaluate updateFunc (to make sure it is defined)
    const wrapperComp: ComponentFunction = (props, ...args) => comp(props, newState => updateFunc(newState), ...args);

    const setUpdateFunction = (vnode: VNode) => {
        updateFunc = update(wrapperComp, vnode);
    };

    return compose(onMount(setUpdateFunction), onUpdate(setUpdateFunction))(wrapperComp);
};


export const withIdempotentState = (comp: ComponentFunction) => {
    const instances = new Map<number, any>();

    return ({key}: { key: number }): ComponentFunction => {
        if (instances.has(key)) {
            return instances.get(key);
        }
        let updateFunc;
        // Lazy evaluate updateFunc (to make sure it is defined)
        const wrapperComp: ComponentFunction = (props, ...args) => comp(props, newState => updateFunc(newState), ...args);

        const setUpdateFunction = (vnode: VNode) => {
            instances.set(key,vnode);
            updateFunc = update(wrapperComp, vnode);
        };

        return compose(onMount(setUpdateFunction), onUpdate(setUpdateFunction))(wrapperComp);
    };
};
