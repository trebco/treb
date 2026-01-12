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

import type { GraphCallbacks } from './spreadsheet_vertex_base';
import { SpreadsheetVertex } from './spreadsheet_vertex';
import { Color } from './vertex';

/**
 * adding a new leaf vertex type that actually does a calculation;
 * but it has no spreadsheet context (address) and by definition it 
 * has no dependendents.
 * 
 * this is intended for managing conditional formats, if they have
 * an expression. we only want to calculate these when necessary 
 * (i.e. dependencies have updated, or they are volatile). 
 * 
 */ 
export class CalculationLeafVertex extends SpreadsheetVertex {

  public static type = 'calculation-leaf-vertex';

  public type = CalculationLeafVertex.type; // for type guard
  
  public address = { row: -1, column: -1 }; // fake address

  /**
   * this type is currently only used for conditional formatting.
   * but that might change in the future. I want to identify what
   * it's used for so we can selectively prune them when necessary.
   */
  public use?: string;

  /** 
   * flag, to reduce unecessary application. work in progress. this
   * indicates that we reached the calculation step. that means either
   * (1) dependencies changed, or (2) we were marked dirty in some global
   * operation, probably a full-recalc. 
   * 
   * (2) is a waste but we're still going to save some cycles here. if you
   * want you could add a state check like the other leaf vertex.
   */
  public updated = false;

  /**
   * leaf vertex defaults to black (i.e. tested) because leaf nodes cannot have 
   * outbound edges. it is still possible to change this, because it's a property 
   * and we can't override the set accessor, but making it an accessor in the 
   * superclass just for this purpose is not worthwhile since regular vertices 
   * should vastly outnumber leaves.
   */
  public color = Color.black;

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

    // ...

    const result = graph.CalculationCallback.call(graph, this);

    this.result = result.value;
    this.dirty = false;

    // set flag

    this.updated = true;

    // we are not allowed to have edges out, so nothing to do

  }

  public AddDependent(): void {
    throw(new Error('leaf vertex cannot have dependents'));
  }

}
