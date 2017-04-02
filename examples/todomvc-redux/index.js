import {createStore} from 'redux';
import reducer from './reducers';
import {h, mount} from '../../index';
// import 'todomvc-app-css/index.css'

const store = createStore(reducer);

const App = ({greeting}) => <p>{greeting}</p>;

mount(App, {greeting: 'hello world'}, document.getElementById('main'));