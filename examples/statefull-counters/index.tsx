import {mount, h, withState, withIdempotentState} from '../../dist/src';

interface CounterInput {
    value: number,
    increment: Function;
    decrement: Function;
}

const CounterView = ({value = 0, increment, decrement}: CounterInput) => {
    return <div>
        <p>The value is {value}</p>
        <button onclick={increment}>Increment</button>
        <button onclick={decrement}>Decrement</button>
    </div>;
};

// @ts-ignore
const Counter = withIdempotentState(({value = 0}, update) => {
    const increment = () => {
        console.log('foo');
        update({value: value + 1});
    };
    const decrement = () => {
        console.log('bar');
        update({value: value - 1});
    };

    return <CounterView value={value} increment={increment} decrement={decrement}/>;
});

const ContainerView = ({onclick}: { onclick: Function, children: any[] }) => {
    return <div>
        // @ts-ignore
        <Counter key={1} value={0}/>
        // @ts-ignore
        <Counter key={2} value={10}/>
        <button onclick={onclick}>Evil update</button>
    </div>;
};

// @ts-ignore
const Container = withState((props, update) => {
    // @ts-ignore
    const onclick = () => update({});
    // @ts-ignore
    return <ContainerView onclick={onclick} {...props} />;
});

const main = document.getElementById('main');

// @ts-ignore
mount(<Container/>, {}, main);
