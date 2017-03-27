//todo provide a generator free version (for old stupid browsers and Safari) :) (cf traverseAsArray)
export const traverse = function * (vnode) {
  yield vnode;
  if (vnode.children && vnode.children.length) {
    for (let child of vnode.children) {
      yield * traverse(child);
    }
  }
};

export const traverseAsArray = function (vnode) {
  const output = [];
  output.push(vnode);
  if (vnode.children && vnode.children.length) {
    for (let child of vnode.children) {
      output.push(...traverseAsArray(child));
    }
  }
  return output;
};

export const nextTick = fn => setTimeout(fn, 0);

export const pairify = holder => key => [key, holder[key]];

export const isShallowEqual = (a, b) => {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  return aKeys.length === bKeys.length && aKeys.every((k) => a[k] === b[k]);
};

export const noop = () => {
};
