import {curry} from 'smart-table-operators';
import {ComponentFunction, VNode} from './h';
import {isVNode, isVTextNode} from './util';

const filterOutFunction = (props: object): [string, any][] => Object
    .entries(props || {})
    .filter(([key, value]) => typeof value !== 'function');

const escapeHTML = s => String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

export const renderAsString = curry((comp: VNode | ComponentFunction, initProp: object) => {
    const vnode = isVNode(comp) ? comp : comp(initProp || {});
    const {nodeType, children, props} = vnode;
    const attributes = escapeHTML(filterOutFunction(props)
        .map(([key, value]) => typeof value === 'boolean' ? (value === true ? key : '') : `${key}="${value}"`)
        .join(' '));
    const childrenHtml = children !== void 0 && children.length > 0 ? children.map(ch => renderAsString(ch)()).join('') : '';
    return isVTextNode(vnode) ? escapeHTML(String(vnode.props.value)) : `<${nodeType}${attributes ? ` ${attributes}` : ''}>${childrenHtml}</${nodeType}>`;
});
