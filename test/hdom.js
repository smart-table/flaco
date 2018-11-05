import test from 'zora';
import { div, span, em } from '../dist/src/hdom';
test('div: should call a div vnode with string children arguments', t => {
    const vnode = div('hello');
    t.deepEqual(vnode, {
        'nodeType': 'div',
        'props': {},
        'children': [{ 'nodeType': 'Text', 'children': [], 'props': { 'value': 'hello' }, 'lifeCycle': 0 }],
        'lifeCycle': 0
    });
});
test('div: should call a div vnode with various children', t => {
    const vnode = div(span('hello'), 'boy', em('!'));
    t.deepEqual(vnode, {
        'nodeType': 'div',
        'props': {},
        'children': [{
                'nodeType': 'span',
                'props': {},
                'children': [{ 'nodeType': 'Text', 'children': [], 'props': { 'value': 'hello' }, 'lifeCycle': 0 }],
                'lifeCycle': 0
            }, { 'nodeType': 'Text', 'children': [], 'props': { 'value': 'boy' }, 'lifeCycle': 0 }, {
                'nodeType': 'em',
                'props': {},
                'children': [{ 'nodeType': 'Text', 'children': [], 'props': { 'value': '!' }, 'lifeCycle': 0 }],
                'lifeCycle': 0
            }],
        'lifeCycle': 0
    });
});
