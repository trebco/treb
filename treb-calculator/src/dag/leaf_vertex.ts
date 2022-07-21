/*
 * This file is part of TREB.
 *
 * TREB is free software: you can redistribute it and/or modify it under the 
 * terms of the GNU General Public License as published by the Free Software 
 * Foundation, either version 3 of the License, or (at your option) any 
 * later version.
 *
 * TREB is distributed in the hope that it will be useful, but WITHOUT ANY 
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS 
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more 
 * details.
 *
 * You should have received a copy of the GNU General Public License along 
 * with Foobar. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

import type { GraphCallbacks } from './spreadsheet_vertex_base';
import { SpreadsheetVertex } from './spreadsheet_vertex';
import { Vertex, Color } from './vertex';

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

  public static type = 'leaf-vertex';

  public state_id = 0;
  public type = LeafVertex.type; // for type guard
  
  /**
   * leaf vertex defaults to black (i.e. tested) because leaf nodes cannot have 
   * outbound edges. it is still possible to change this, because it's a property 
   * and we can't override the set accessor, but making it an accessor in the 
   * superclass just for this purpose is not worthwhile since regular vertices 
   * should vastly outnumber leaves.
   */
  public color = Color.black;

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
  public UpdateState(): void {

    // FIXME: hash!
    const state = JSON.stringify(this.edges_in.map((edge) => (edge as SpreadsheetVertex).result));

    if (state !== this.state_representation) {
      this.state_representation = state;
      this.state_id++;
    }

  }

  /** overrides calculate function */
  public Calculate(graph: GraphCallbacks): void {

    // if we are not dirty, nothing to do
    if (!this.dirty) return;

    // check deps
    for (const edge of this.edges_in) {
      if ((edge as SpreadsheetVertex).dirty) {
        return;
      }
    }

    // ok, we can evaluate... all we are doing here is checking state consistency
    this.UpdateState();
    this.dirty = false;

    // we are not allowed to have edges out, so nothing to do
  }

  public AddDependent(edge: Vertex): void {
    throw(new Error('leaf vertex cannot have dependents'));
  }

}
