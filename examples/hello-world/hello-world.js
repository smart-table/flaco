import { mount, h } from '../../dist/src';
const Greeter = (props) => h("p", { lang: props.lang }, `${props.hello} ${props.world}!`);
const main = document.getElementById('main');
mount(h(Greeter, { lang: "fr", hello: "Bonjour", world: "monde" }), {}, main);
