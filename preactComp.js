import {h, Component} from 'preact';


const Item = ({item, children}) => (<li id={item.id}>{children}</li>);

function itemify (string) {
  const items = [];
  const numbers =Math.ceil(Math.random() * 1000);
  console.log(numbers)
  for (let i = 0; i < numbers; i++) {
    items.push({id: i, value: string + i + ' ' + Date.now()});
  }

  return items;
}

export default class Div extends Component {
  constructor (props) {
    super(props);
    this.state = {items: props.items};
  }

  componentWillUpdate () {
    console.time('update preact');
  }

  componentDidUpdate () {
    console.timeEnd('update preact');
  }

  render (props, {items}) {
    return (<div>
      <button onClick={() => this.setState({items: itemify('updated at ')})}>update</button>
      <ul>
        {
          items.map(item => (<Item item={item}>{item.value}</Item>))
        }
      </ul>
    </div>);
  }
}