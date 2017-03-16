import {createDomNode} from './util';

// if you have specific memory requirement:
// this instance will clean and reuse dom nodes
// instead of throwing them and recreating new ones
export default function () {

  const pool = {};

  const recycler = {
    create(vnode){
      const p = pool[vnode.nodeType] || [];
      const t = p.shift();
      return t || createDomNode(vnode);
    },
    collect(garbage){
      for (let vnode of garbage) {
        const dom = vnode.dom;
        //todo clean dom node event listeners etc
        vnode.dom = null;
        pool[vnode.nodeType] = pool[vnode.nodeType] || [];
        pool[vnode.nodeType].push(dom);
        recycler.collect(vnode.children);
      }
    }
  };
  return recycler;
}