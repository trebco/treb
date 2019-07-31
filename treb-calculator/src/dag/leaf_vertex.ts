
import { SpreadsheetVertex } from './spreadsheet_vertex';
import { VertexType } from './vertex_type';

/**
 * second specialization of vertex: this class is for non-cell elements
 * that are dependent on cells: specifically, charts.
 *
 * we want leaf vertices to participate in the normal dirty/calculate
 * cycle, but they don't need to do any calculation other than checking
 * if the underlying data has changed. we should maintain some state so
 * this is a simple check for observers.
 *
 * leaves specifically do not have addresses. we can represent the chart
 * as a calculation, however. (...)
 *
 * FIXME: it might be better to have an intermediate class/interface and
 * have both leaf- and spreadsheet-vertex extend that.
 *
 */
export class LeafVertex extends SpreadsheetVertex {

  public state_id: number = 0;
  public type = 'leaf-vertex'; // for type guard

  protected state_representation = '';

  /**
   * construct the state, compare, and increment the state id if
   * it changes. this is expected to be called from Calculate(), but
   * we can also call it on init if we already know the state.
   *
   * FIXME: what's more expensive, generating this state field or
   * re-rendering a chart with the same data? (...?)
   * especially since it's only called on dirty...
   *
   * what is the case where the depenendency is dirty but state
   * does not change? you type in the same value? (...) or maybe
   * there's a volatile function that doesn't change value (e.g. Today())
   *
   * still, it seems like a waste here. let's test without the state.
   * (meaning just update the flag anytime it's dirty)
   *
   * Actually I think the case is manual recalc, when values don't change
   * (especially true for MC charts).
   *
   * TODO: perf
   */
  public UpdateState(){

    // FIXME: hash!
    const state = JSON.stringify(this.edges_in.map((edge) => (edge as SpreadsheetVertex).result));

    if (state !== this.state_representation) {
      this.state_representation = state;
      this.state_id++;
    }

  }

  /** overrides calculate function */
  public Calculate(
    graph: any,
    callback: (vertex: SpreadsheetVertex) => any,
    spread_callback: (vertex: SpreadsheetVertex, value: any) => void){

    // if we are not dirty, nothing to do
    if (!this.dirty) return;

    // check deps
    if (this.edges_in.some((edge) => (edge as SpreadsheetVertex).dirty)) return;

    // ok, we can evaluate... all we are doing here is checking state consistency
    this.UpdateState();
    this.dirty = false;

    // we are not allowed to have edges out, so nothing to do
  }

  public AddDependent(edge: VertexType){
    throw(new Error('leaf vertex cannot have dependents'));
  }

}
