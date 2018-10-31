import test from 'zora';
import {isShallowEqual, pairify} from '../dist/src/util';
import {traverse} from '../dist/src/traverse';
import {VNode, h} from '../dist/src';


test('should traverse a tree (going deep first)', t => {

    const tree = <ul id="1">
        <li id="2">
            <span id="3"></span>
            <span id="4"></span>
        </li>
        <li id="5">
            <span id="6"></span>
        </li>
        <li id="7"></li>
    </ul>;

    const sequence = [...traverse(tree)].map(n => n.props.id);
    t.deepEqual(sequence, ['1', '2', '3', '4', '5', '6', '7']);
});
test('pair key to value object of an object (aka Object.entries)', t => {
    const holder = {a: 1, b: 2, c: 3, d: 4};
    const f = pairify(holder);
    const data = Object.keys(holder).map(f);
    t.deepEqual(data, [['a', 1], ['b', 2], ['c', 3], ['d', 4]]);
});
test('shallow equality test on object', t => {
    const nested = {foo: 'bar'};
    const obj1 = {a: 1, b: '2', c: true, d: nested};
    t.ok(isShallowEqual(obj1, {a: 1, b: '2', c: true, d: nested}));
    t.notOk(isShallowEqual(obj1, {
        a: 1,
        b: '2',
        c: true,
        d: {foo: 'bar'}
    }), 'nested object should be checked by reference');
    t.notOk(isShallowEqual(obj1, {a: 1, b: 2, c: true, d: nested}), 'exact type checking on primitive');
    t.notOk(isShallowEqual(obj1, {a: 1, c: true, d: nested}), 'return false on missing properties');
    t.notOk(isShallowEqual({a: 1, c: true, d: nested}, obj1), 'return false on missing properties (commmutative');
});
