import {ComponentFunction, h, mount, onMount, onUnMount, onUpdate, update, VNode} from '../../dist/src';
import {compose} from 'smart-table-operators';

const updateEverySecond = (comp: ComponentFunction) => (intialValues): ComponentFunction => {
    let updateFunc;

    const timer = setInterval(() => {
        const newState = Object.assign({}, intialValues, {timestamp: Date.now()});
        updateFunc(newState);
    }, 1000);

    const setUpdateFunction = (vnode: VNode) => {
        updateFunc = update(comp, vnode);
    };

    const clean = () => {
        clearInterval(timer);
    };

    return compose(onMount(setUpdateFunction), onUpdate(setUpdateFunction), onUnMount(clean))(comp);
};

interface ClockInput {
    timestamp: number;
    eventTime: number;
    label: string;
}

const ClockView = ({eventTime, label, timestamp}: ClockInput) => {
    const secondEllapsed = Math.trunc((timestamp - eventTime) / 1000);
    return <p>
        Since <strong>{label}</strong>, <em>{secondEllapsed}</em> seconds have passed !
    </p>;
};

const Clock = updateEverySecond(ClockView);

const App = () => <div>
    <Clock label="my birth" eventTime={(new Date(1987, 4, 21)).getTime()}
           timestamp={Date.now()}/>
    <Clock label="my mother's birth" eventTime={(new Date(1958, 7, 27)).getTime()}
           timestamp={Date.now()}/>
</div>;

mount(<App/>, {}, document.getElementById('main'));
