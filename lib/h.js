export default function h (nodeType, props, ...children) {
  const flatChildren = children.reduce((acc, child) => {
    const childrenArray = Array.isArray(child) ? child : [child];
    return acc.concat(childrenArray);
  }, [])
    .map(child => {
      // normalize text node to have same structure than regular dom node (looks like easier for runtime to optimize)
      const s = typeof child;
      return s !== 'function' && s !== 'object' ? {
          nodeType: 'Text',
          children: [],
          props: {
            value: child
          },
          events: {},
          length: 0
        } : child;
    });

  if (typeof nodeType === 'function') {
    return nodeType(Object.assign({children: flatChildren}, props));
  }

  const attributes = Object.assign({}, props);
  const events = {};
  const eventKeys = Object.keys(props || {}).filter(k => k.substr(0, 2) === 'on');

  for (let ev of eventKeys) {
    events[ev.substr(2).toLowerCase()] = props[ev];
    delete attributes[ev];
  }

  return {
    nodeType,
    props: attributes,
    children: flatChildren,
    length: flatChildren.length,
    events
  };
};