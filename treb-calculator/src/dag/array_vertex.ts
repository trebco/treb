
import { Vertex } from './vertex';
import { Cell, ICellAddress, Area } from 'treb-base-types';
import { SpreadsheetVertex } from './spreadsheet_vertex';

type Graph = import('./graph').Graph; // circular; type only

/**
 * specialization of vertex
 */
export class ArrayVertex extends Vertex {

  public type = 'array-vertex'; // for type guard

  public area = new Area({row: 0, column: 0});

  /* *
   * NOTE: DO NOT CALL THIS. call the graph method, which updates the
   * dirty list.
   *
   * Q: so why is it here at all? why not have graph do the propagation?
   * edges are public, so there's no encapsulation problem. and if we're
   * doing propagation, why are edges public?
   *
   * sets dirty, propagates.
   * /
  public SetDirty() {

    // if we are already dirty, then our children are already
    // dirty and we can skip this.

    // if (this.dirty) return;

    // otherwise set flag and propagate

    // this.dirty = true;

    // special case: if there's a loop, we don't want to propagate
    // ...that should be handled when the edge is added, no?

    // propagate

    for (const edge of this.edges_out) {
      (edge as SpreadsheetVertex).SetDirty();
    }

  }
  */

}
