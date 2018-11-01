import {mount, h, withState, withIdempotentState} from '../../dist/src';

interface CounterInput {
    value: number,
    increment: Function;
    decrement: Function;
}

// Pure and stateless view component
const CounterView = ({value = 0, increment, decrement}: CounterInput) => {
    return <div>
        <p>The value is {value}</p>
        <button onclick={increment}>Increment</button>
        <button onclick={decrement}>Decrement</button>
    </div>;
};

// Statefull and Connected Component
const UpdatableCounter = ({value = 0}, update) => {
    const increment = () => {
        update({value: value + 1});
    };
    const decrement = () => {
        update({value: value - 1});
    };

    return <CounterView value={value} increment={increment} decrement={decrement}/>;
};
const IdempotentCounter = withIdempotentState<{ key: number, value: number }>(UpdatableCounter);
const StatefullCounter = withState<{ value: number }>(UpdatableCounter);

// Statefull counters
const StatefullContainerView = ({onclick}: { onclick: Function }) => {
    return <section>
        <h1>Statefull counters</h1>
        <p>The counters manage their own state. It means when one is incremented or decremented, only that one gets
            updated.</p>
        <p>However if you update the container (by clicking the evil update). The container will recreate its counters
            and the counters will be fresh new instances</p>
        <StatefullCounter value={0}/>
        <StatefullCounter value={10}/>
        <button onclick={onclick}>Evil update</button>
    </section>;
};

const StatefullContainer = withState((props, update) => {
    const onclick = () => update({});
    return <StatefullContainerView onclick={onclick} {...props} />;
});

// Application with Idempotent counters
const IdempotentContainerView = ({onclick}: { onclick: Function }) => {
    return <section>
        <h1>Idempotent counters</h1>
        <p>It has <em>idempotent counters</em>. It means that even if the container is updated, the old instances of the
            counters are kept and values are not reset</p>
        <IdempotentCounter key={1} value={0}/>
        <IdempotentCounter key={2} value={10}/>
        <button onclick={onclick}>Evil update</button>
    </section>;
};

// @ts-ignore
const IdempotentContainer = withState((props, update) => {
    const onclick = () => update({});
    return <IdempotentContainerView onclick={onclick} {...props} />;
});

const main = document.getElementById('main');
const fragment1 = document.createDocumentFragment();
const fragment2 = document.createDocumentFragment();
mount(<StatefullContainer/>, {}, fragment1);
mount(<IdempotentContainer/>, {}, fragment2);

main.appendChild(fragment1);
main.appendChild(fragment2);
