import {bindActionCreators} from 'redux'
import {h} from '../../../index';
import Header from '../components/Header'
import MainSection from '../components/MainSection'
import * as TodoActions from '../actions'

const App = ({todos}, actions) => (
  <div>
    <Header addTodo={actions.addTodo}/>
    <MainSection todos={todos} actions={actions}/>
  </div>
)


const mapStateToProps = state => ({
  todos: state.todos
})

const mapDispatchToProps = dispatch => ({
  actions: bindActionCreators(TodoActions, dispatch)
})

export default connect(
  mapStateToProps,
  mapDispatchToProps
)(App)
