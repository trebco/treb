
import { Vertex } from './vertex';
import { SpreadsheetVertexBase } from './spreadsheet_vertex_base';
import { Cell, ICellAddress, ValueType } from 'treb-base-types';
import { ExpressionUnit } from 'treb-parser';

type Graph = import('./graph').Graph; // circular; type only

export enum SpreadsheetError {
  None,
  CalculationError,
}

export interface CalculationResult {
  value: any;
  volatile?: boolean;
}

/**
 * specialization of vertex with attached data and calculation metadata
 */
export class SpreadsheetVertex extends SpreadsheetVertexBase {

  public reference?: Cell;

  public error = SpreadsheetError.None;

  // why is this (?)? can't we use a default junk address?
  public address?: ICellAddress;

  public result: any;
  public expression: ExpressionUnit = { type: 'missing', id: -1 };
  public expression_error = false;
  public short_circuit = false;

  public type = 'spreadsheet-vertex'; // for type guard

  get array_head(){
    if (!this.address) return null;
    return this.reference
      && this.reference.area
      && this.reference.area.start.column === this.address.column
      && this.reference.area.start.row === this.address.row;

  }

  /**
   * to support restoring cached values (from file), we need a way to get
   * the value from the reference (cell). normally this is done during
   * calculation, and in reverse (we set the value).
   *
   * some additional implications of this:
   *
   * - does not set volatile/nonvolatile, which is usually managed as a
   *   side-effect of the calculation.
   *
   * - does not remove the entry from the dirty list
   *
   * - does not clear the internal dirty flag. it used to do that, but we
   *   took it out because we are now managing multple vertex types, and
   *   we don't want to attach that behavior to a type-specific method.
   *
   * so the caller needs to explicitly address the dirty and volatile lists
   * for this vertex.
   */
  public TakeReferenceValue() {
    if (this.reference) {
      this.result = this.reference.GetValue();
    }
  }

  /**
   * calculates the function, but only if all dependencies are clean.
   * if one or more dependencies are dirty, just exit. this should work out
   * so that when the last dependency is satisfied, the propagation will
   * succeed. FIXME: optimize order.
   *
   * FIXME: why is this in vertex, instead of graph? [a: dirty check?]
   * A: for overloading. leaf extends this class, and has a separate
   * calculation routine.
   */
  public Calculate(graph: Graph): void {

    if (!this.dirty) return;

    // this is done before checking if it's a formula for the case of
    // arrays: arrays are not formulae but they are dependent on the
    // array head. if the head is dirty we need to calculate that before
    // any dependents of _this_ cell are calculated.

    // the head calculation should take care of setting this value, that is,
    // we don't need to do the actual lookup.

    for (const edge of this.edges_in) {
      if ((edge as SpreadsheetVertexBase).dirty) {
        return;
      }
    }

    // we won't have a reference if the reference is to an empty cell,
    // so check that.

    if (this.reference) {

      if (this.reference.type === ValueType.formula) {

        this.short_circuit = false;
        const result = graph.CalculationCallback.call(graph, this);
        this.result = result.value;

        // this test is a waste for 99% of calls
        if (this.short_circuit) {
          return;
        }

        // and this one for ~75%?
        if (result.volatile) graph.volatile_list.push(this);
      }
      else this.result = this.reference.GetValue();

      if (this.array_head) {
        graph.SpreadCallback.call(graph, this, this.result);
      }
      else if (this.reference.type === ValueType.formula) {
        if (typeof this.result === 'object' && this.result.error) {
          this.reference.SetCalculationError(this.result.error);
        }
        else {
          this.reference.SetCalculatedValue(this.result);
        }
      }

    }
    else {
      console.info('skip dirty constant?');
    }

    this.dirty = false;

    for (const edge of this.edges_out){
      (edge as SpreadsheetVertex).Calculate(graph);
    }

  }

}
