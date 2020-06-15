import { Vertex } from './vertex';

type Graph = import('./graph').Graph; // circular; type only

export abstract class SpreadsheetVertexBase extends Vertex {

  public dirty = false;

  public abstract Calculate(graph: Graph): void;

  /* *
   * NOTE: DO NOT CALL THIS. call the graph method, which updates the
   * dirty list.
   *
   * Q: so why is it here at all? why not have graph do the propagation?
   * edges are public, so there's no encapsulation problem. and if we're
   * doing propagation, why are edges public?
   *
   * sets dirty, propagates.
   *
   * returns the original state -- meaning, true = "I was already dirty",
   * false = "I was not previously dirty". callers can use that to drive
   * behavior.
   *
   * /
  public SetDirty(): boolean {

    // if we are already dirty, then our children are already
    // dirty and we can skip this.

    if (this.dirty) {
      return true; // was already dirty
    }

    // otherwise set flag and propagate

    this.dirty = true;

    // special case: if there's a loop, we don't want to propagate
    // ...that should be handled when the edge is added, no?

    // propagate

    for (const edge of this.edges_out) {
      (edge as SpreadsheetVertexBase).SetDirty();
    }

    return false; // was not dirty before

  }
  */

}
