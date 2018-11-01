import {mount, h} from '../../dist/src';

interface Greetings {
    hello: string;
    world: string;
    lang: string;
}

const Greeter = (props: Greetings) => <p lang={props.lang}>{`${props.hello} ${props.world}!`}</p>;

const main = document.getElementById('main');

mount(<Greeter lang="fr" hello="Bonjour" world="monde" />,{}, main);
