import {curry, compose} from 'smart-table-operators';

const lifeCycleFactory = method => curry((fn, comp) => (props, ...args) => {
	const n = comp(props, ...args);
	const applyFn = () => fn(n, ...args);
	const current = n[method];
	n[method] = current ? compose(current, applyFn) : applyFn;
	return n;
});

/**
 * Life cycle: when the component is mounted
 */
export const onMount = lifeCycleFactory('onMount');

/**
 * Life cycle: when the component is unmounted
 */
export const onUnMount = lifeCycleFactory('onUnMount');

/**
 * Life cycle: before the component is updated
 */
export const onUpdate = lifeCycleFactory('onUpdate');