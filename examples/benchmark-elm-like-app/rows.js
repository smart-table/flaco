import {h} from "../../index"

export default ({model, actions}) => model.data.map(({id, label}, i) =>
  <tr class={id === model.selected ? "danger" : ""}>
    <td class="col-md-1">{id}</td>
    <td class="col-md-4">
      <a onclick={_ => actions.select({id})}>{label}</a>
    </td>
    <td class="col-md-1">
      <a onclick={_ => actions.delete({id})}>
                <span class="glyphicon glyphicon-remove" aria-hidden="true">
                </span>
      </a>
    </td>
    <td class="col-md-6"></td>
  </tr>
)
