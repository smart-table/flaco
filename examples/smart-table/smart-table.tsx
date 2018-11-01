import {ComponentFunction, h, mount, onMount, onUnMount, update, VNode} from '../../dist/src';
import {
    DisplayedItem, searchDirective,
    smartTable,
    SmartTable,
    SmartTableEvents,
    SortConfiguration,
    SortDirection,
    sortDirective
} from 'smart-table-core';

import {Hero, heroes} from './fixture';

interface ListInput {
    items: DisplayedItem<Hero>[];
}

interface HeroRowInput {
    hero: Hero;
}

const HeroRow = (props: HeroRowInput) => <tr>
    <td>{props.hero.id}</td>
    <td>{props.hero.name}</td>
</tr>;

const TableBody = (props: ListInput) => <tbody>
{props.items.map(hero => <HeroRow hero={hero.value}/>)}
</tbody>;

const SortableHeader = ({toggleSort, className, children}) => {
    return <th class={className} onclick={toggleSort}>{children}</th>;
};

const SearchInput = ({onInput}) => <input placeholder="case sensitive search" type="search" oninput={onInput}/>;

interface HeaderConfiguration {
    table: SmartTable<Hero>;
    pointer: string;
    cycle?: boolean;
}

interface SearchInputConfiguration {
    scope: string[];
    table: SmartTable<Hero>;
}

const withTableChange = (comp: ComponentFunction) => ({table, items = []}: { table: SmartTable<Hero>; items?: DisplayedItem<Hero>[] }) => {
    let updateFunc;
    const listener = items => updateFunc({items});

    table.onDisplayChange(listener);

    const subscribe = onMount((vnode: VNode) => {
        updateFunc = update(comp, vnode);
        table.exec();
    });

    const unsubscribe = onUnMount(() => {
        table.off(SmartTableEvents.DISPLAY_CHANGED, listener);
    });

    return unsubscribe(subscribe(comp));
};

const withSortChange = (comp: ComponentFunction) => (conf: HeaderConfiguration) => {
    let updateFunc;
    const {table, pointer, cycle = false} = conf;
    const listener = (sortState: SortConfiguration) => updateFunc(sortState);
    const directive = sortDirective({table, pointer, cycle});

    const wrappedComponent = (sortState: SortConfiguration) => {
        let className = '';
        if (sortState.pointer === conf.pointer) {
            className = sortState.direction === SortDirection.ASC ?
                'st-sort-asc' :
                (sortState.direction === SortDirection.DESC ?
                    'st-sort-desc' : className);
        }
        const props = {toggleSort: () => directive.toggle('whatever?'), ...conf, className, ...directive.state()};
        return comp(props);
    };

    const subscribe = onMount((vnode: VNode) => {
        updateFunc = update(wrappedComponent, vnode);
        directive.onSortToggle(listener);
    });

    const unsubscribe = onUnMount(() => directive.off(SmartTableEvents.TOGGLE_SORT));

    return unsubscribe(subscribe(wrappedComponent));
};

const withSearchChange = (comp: ComponentFunction) => (conf: SearchInputConfiguration) => {
    const {table, scope} = conf;
    const directive = searchDirective({table, scope});
    const onInput = ev => {
        const val = ev.target.value;
        directive.search(val);
    };

    return (props) => comp({onInput, ...props});
};

const Table = withTableChange(TableBody);
const Header = withSortChange(SortableHeader);
const Search = withSearchChange(SearchInput);

const App = ({table}) => {
    return <div>
        <thead>
        <tr>
            <Header table={table} pointer="id">
                <span>ID</span>
            </Header>
            <Header table={table} pointer="name" cycle={true}>
                <span>Name</span>
            </Header>
        </tr>
        <tr>
            <th colspan="2"><Search scope={['id', 'name']} table={table}/></th>
        </tr>
        </thead>
        <Table table={table} items={[]}/>
    </div>;
};

const heroList = smartTable({data: heroes});
const main = document.getElementById('app-container');

mount(<App table={heroList}/>, {}, main);
