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
 * with TREB. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022-2026 trebco, llc. 
 * info@treb.app
 * 
 */

import { SpreadsheetVertex } from './spreadsheet_vertex';
import { Color } from './vertex';

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
 * UPDATE: we're removing the internal "state" representation because (1)
 * it should be unnecessary, if we are only updating when dependencies
 * change, and (2) it was broken anyway.
 * 
 * Now we rely on the calculation graph to indicate when the leaf is 
 * dirty and needs to update. This will result in extra calculation when
 * you do a hard recalc, but that seems reasonable (and we could possibly
 * work around that).
 * 
 */
export class StateLeafVertex extends SpreadsheetVertex {

  public static type = 'state-leaf-vertex';

  public state_id = 0;
  public type = StateLeafVertex.type; // for type guard
  
  /**
   * leaf vertex defaults to black (i.e. tested) because leaf nodes cannot have 
   * outbound edges. it is still possible to change this, because it's a property 
   * and we can't override the set accessor, but making it an accessor in the 
   * superclass just for this purpose is not worthwhile since regular vertices 
   * should vastly outnumber leaves.
   */
  public color = Color.black;

  /** overrides calculate function */
  public Calculate(): void {

    // if we are not dirty, nothing to do
    if (!this.dirty) return;

    // check deps
    for (const edge of this.edges_in) {
      if ((edge as SpreadsheetVertex).dirty) {
        return;
      }
    }

    // ok update state so clients know they need to refresh
    // (see note above re: internal state)

    this.state_id++; 

    // and we're clean

    this.dirty = false;

  }

  public AddDependent(): void {
    throw(new Error('leaf vertex cannot have dependents'));
  }

}
