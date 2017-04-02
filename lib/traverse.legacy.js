/**
 * generator free version of ./traverse.js
 * @param vnode
 * @returns {Array}
 */
export const traverse = function (vnode) {
  const output = [];
  output.push(vnode);
  if (vnode.children && vnode.children.length) {
    for (let child of vnode.children) {
      output.push(...traverse(child));
    }
  }
  return output;
};
