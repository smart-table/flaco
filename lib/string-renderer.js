import {curry} from 'smart-table-operators';

const filterOutFunction = props => Object
	.entries(props || {})
	.filter(([key, value]) => typeof value !== 'function');

const escapeHTML = s => String(s)
	.replace(/&/g, '&amp;')
	.replace(/</g, '&lt;')
	.replace(/>/g, '&gt;');

const render = curry((comp, initProp) => {
	const vnode = comp.nodeType !== void 0 ? comp : comp(initProp || {});
	const {nodeType, children, props} = vnode;
	const attributes = escapeHTML(filterOutFunction(props)
		.map(([key, value]) => typeof value === 'boolean' ? (value === true ? key : '') : `${key}="${value}"`)
		.join(' '));
	const childrenHtml = children !== void 0 && children.length > 0 ? children.map(ch => render(ch)()).join('') : '';
	return nodeType === 'Text' ? escapeHTML(String(props.value)) : `<${nodeType}${attributes ? ` ${attributes}` : ''}>${childrenHtml}</${nodeType}>`;
});

export default render;
