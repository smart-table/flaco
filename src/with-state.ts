import {compose} from 'smart-table-operators';
import {update} from './update';
import {onMount, onUpdate, onUnMount} from './lifecycles';
import {ComponentFunction, VNode} from './h';

export const withState = <T>(comp: ComponentFunction) => (initialState: T): ComponentFunction => {
    let updateFunc;
    // Lazy evaluate updateFunc (to make sure it is defined)
    const wrapperComp: ComponentFunction = (props, ...args) => {
        const fullProps = Object.assign({}, initialState, props);
        return comp(fullProps, newState => updateFunc(newState), ...args);
    };

    const setUpdateFunction = (vnode: VNode) => {
        updateFunc = updateFunc ? updateFunc : update(wrapperComp, vnode);
    };

    return compose(onMount(setUpdateFunction), onUpdate(setUpdateFunction))(wrapperComp);
};

export interface Keyable {
    key: number;
}

export const withIdempotentState = <T extends Keyable>(comp: ComponentFunction) => {
    const instances = new Map<number, any>();

    return (initialProps: T): ComponentFunction => {

        const {key} = initialProps;

        if (instances.has(key)) {
            return instances.get(key);
        }
        let updateFunc;
        // Lazy evaluate updateFunc (to make sure it is defined)
        const wrapperComp: ComponentFunction = (props, ...args) => {
            const fullProps = Object.assign({}, initialProps, props);
            return comp(fullProps, newState => updateFunc(newState), ...args);
        };

        const setUpdateFunction = (vnode: VNode) => {
            instances.set(key, vnode);
            updateFunc = updateFunc ? updateFunc : update(wrapperComp, vnode);
        };

        const removeInstance = () => instances.delete(key);

        return compose(onMount(setUpdateFunction), onUpdate(setUpdateFunction), onUnMount(removeInstance))(wrapperComp);
    };
};
