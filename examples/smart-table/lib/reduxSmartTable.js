// it is like Redux but using smart table which already behaves more or less like a store and like a reducer in the same time.
// of course this impl is basic: error handling etc are missing and reducer is "hardcoded"
const reducerFactory = function (smartTable) {
  return function (state = {
    tableState: smartTable.getTableState(),
    displayed: [],
    summary: {},
    isProcessing: false
  }, action) {
    const {type, args} = action;
    switch (type) {
      case 'TOGGLE_FILTER': {
        const {filter} = action;
        return Object.assign({}, state, {activeFilter: filter});
      }
      default: //proxy to smart table
        if (smartTable[type]) {
          smartTable[type](...args);
        }
        return state;
    }
  }
};

export function createStore (smartTable) {

  const reducer = reducerFactory(smartTable);

  let currentState = {
    tableState: smartTable.getTableState()
  };
  let summary;
  let listeners = [];

  const broadcast = () => {
    for (let l of listeners) {
      l();
    }
  };

  smartTable.on('SUMMARY_CHANGED', function (s) {
    summary = s;
  });

  smartTable.on('EXEC_CHANGED', function ({working}) {
    Object.assign(currentState, {
      isProcessing: working
    });
    broadcast();
  });

  smartTable.onDisplayChange(function (displayed) {
    Object.assign(currentState, {
      tableState: smartTable.getTableState(),
      displayed,
      summary
    });
    broadcast();
  });

  return {
    subscribe(listener){
      listeners.push(listener);
      return () => {
        listeners = listeners.filter(l => l !== listener);
      }
    },
    getState(){
      return Object.assign({}, currentState, {tableState:smartTable.getTableState()});
    },
    dispatch(action = {}){
      currentState = reducer(currentState, action);
      if (action.type && !smartTable[action.type]) {
        broadcast();
      }
    }
  };
}