export const nextTick = fn => setTimeout(fn, 0);

export const pairify = holder => key => [key, holder[key]];

export const isShallowEqual = (a, b) => {
	const aKeys = Object.keys(a);
	const bKeys = Object.keys(b);
	return aKeys.length === bKeys.length && aKeys.every(k => a[k] === b[k]);
};

const ownKeys = obj => Object.getOwnPropertyNames(obj);

export const isDeepEqual = (a, b) => {
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

export const identity = a => a;

export const noop = () => {};
