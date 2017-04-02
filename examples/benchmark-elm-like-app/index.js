'use strict';
import {model, reducers} from "./store"
import RowsView from "./rows"
import {elm as app, h, mount} from '../../index'

let startTime;
let lastMeasure;

function startMeasure (name, cb) {
  startTime = performance.now()
  // performance.mark('start ' + name);
  lastMeasure = name;
  cb();
}

function stopMeasure () {
  const last = lastMeasure;

  if (lastMeasure) {
    window.setTimeout(
      function metaStopMeasure () {
        lastMeasure = null
        const stop = performance.now()
        // performance.mark('end ' + last);
        // performance.measure(last, 'start ' + last, 'end ' + last);
        console.log(last + " took " + (stop - startTime))
      },
      0
    )
  }
}

function view (model, actions) {
  stopMeasure()
  return (
    <div class="container">
      <div class="jumbotron">
        <div class="row">
          <div class="col-md-6">
            <h1>Flaco 0.1.0</h1>
          </div>
          <div class="col-md-6">
            <div class="row">
              <div class="col-sm-6 smallpad">
                <button
                  type="button"
                  class="btn btn-primary btn-block"
                  id="run"
                  onClick={_ =>
                    startMeasure("run", actions.run)}>
                  Create 1,000 rows
                </button>
              </div>
              <div class="col-sm-6 smallpad">
                <button
                  type="button"
                  class="btn btn-primary btn-block"
                  id="runlots"
                  onClick={_ =>
                    startMeasure(
                      "runLots",
                      actions.runLots
                    )}>
                  Create 10,000 rows
                </button>
              </div>
              <div class="col-sm-6 smallpad">
                <button
                  type="button"
                  class="btn btn-primary btn-block"
                  id="add"
                  onClick={_ =>
                    startMeasure("add", actions.add)}>
                  Append 1,000 rows
                </button>
              </div>
              <div class="col-sm-6 smallpad">
                <button
                  type="button"
                  class="btn btn-primary btn-block"
                  id="update"
                  onClick={_ =>
                    startMeasure("update", actions.update)}>
                  Update every 10th row
                </button>
              </div>
              <div class="col-sm-6 smallpad">
                <button
                  type="button"
                  class="btn btn-primary btn-block"
                  id="clear"
                  onClick={_ =>
                    startMeasure("clear", actions.clear)}>
                  Clear
                </button>
              </div>
              <div class="col-sm-6 smallpad">
                <button
                  type="button"
                  class="btn btn-primary btn-block"
                  id="swaprows"
                  onClick={_ =>
                    startMeasure(
                      "swapRows",
                      actions.swapRows
                    )}>
                  Swap Rows
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
      <table class="table table-hover table-striped test-data">
        <tbody>
        <RowsView model={model} actions={actions}/>
        </tbody>
      </table>
      <span
        class="preloadicon glyphicon glyphicon-remove"
        aria-hidden="true"
      />
    </div>);
}

const Bench = app(view);

mount(({model, updates}) => (<Bench model={model} updates={updates}/>), {
  model, updates: reducers
}, document.getElementById("main"));
