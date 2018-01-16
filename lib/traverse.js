export default function * traverse(vnode) {
	yield vnode;
	if (vnode.children && vnode.children.length > 0) {
		for (const child of vnode.children) {
			yield * traverse(child);
		}
	}
}
