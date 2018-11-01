import { h, mount, onMount, onUnMount, update } from '../../dist/src';
import { searchDirective, smartTable, sortDirective } from 'smart-table-core';
import { heroes } from './fixture';
const HeroRow = (props) => h("tr", null,
    h("td", null, props.hero.id),
    h("td", null, props.hero.name));
const TableBody = (props) => h("tbody", null, props.items.map(hero => h(HeroRow, { hero: hero.value })));
const SortableHeader = ({ toggleSort, className, children }) => {
    return h("th", { class: className, onclick: toggleSort }, children);
};
const SearchInput = ({ onInput }) => h("input", { placeholder: "case sensitive search", type: "search", oninput: onInput });
const withTableChange = (comp) => ({ table, items = [] }) => {
    let updateFunc;
    const listener = items => updateFunc({ items });
    table.onDisplayChange(listener);
    const subscribe = onMount((vnode) => {
        updateFunc = update(comp, vnode);
        table.exec();
    });
    const unsubscribe = onUnMount(() => {
        table.off("DISPLAY_CHANGED" /* DISPLAY_CHANGED */, listener);
    });
    return unsubscribe(subscribe(comp));
};
const withSortChange = (comp) => (conf) => {
    let updateFunc;
    const { table, pointer, cycle = false } = conf;
    const listener = (sortState) => updateFunc(sortState);
    const directive = sortDirective({ table, pointer, cycle });
    const wrappedComponent = (sortState) => {
        let className = '';
        if (sortState.pointer === conf.pointer) {
            className = sortState.direction === "asc" /* ASC */ ?
                'st-sort-asc' :
                (sortState.direction === "desc" /* DESC */ ?
                    'st-sort-desc' : className);
        }
        const props = Object.assign({ toggleSort: () => directive.toggle('whatever?') }, conf, { className }, directive.state());
        return comp(props);
    };
    const subscribe = onMount((vnode) => {
        updateFunc = update(wrappedComponent, vnode);
        directive.onSortToggle(listener);
    });
    const unsubscribe = onUnMount(() => directive.off("TOGGLE_SORT" /* TOGGLE_SORT */));
    return unsubscribe(subscribe(wrappedComponent));
};
const withSearchChange = (comp) => (conf) => {
    const { table, scope } = conf;
    const directive = searchDirective({ table, scope });
    const onInput = ev => {
        const val = ev.target.value;
        directive.search(val);
    };
    return (props) => comp(Object.assign({ onInput }, props));
};
const Table = withTableChange(TableBody);
const Header = withSortChange(SortableHeader);
const Search = withSearchChange(SearchInput);
const App = ({ table }) => {
    return h("div", null,
        h("thead", null,
            h("tr", null,
                h(Header, { table: table, pointer: "id" },
                    h("span", null, "ID")),
                h(Header, { table: table, pointer: "name", cycle: true },
                    h("span", null, "Name"))),
            h("tr", null,
                h("th", { colspan: "2" },
                    h(Search, { scope: ['id', 'name'], table: table })))),
        h(Table, { table: table, items: [] }));
};
const heroList = smartTable({ data: heroes });
const main = document.getElementById('app-container');
mount(h(App, { table: heroList }), {}, main);
