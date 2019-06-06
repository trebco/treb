
import { VertexType } from './vertex_type';

import { Cell, CellAddress, ValueType } from 'treb-base-types';
import { Parser, ExpressionUnit } from 'treb-parser';

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
export class SpreadsheetVertex extends VertexType {

  public reference?: Cell;
  public dirty = false;
  public error = SpreadsheetError.None;
  public address?: CellAddress;
  public result: any;
  public expression: ExpressionUnit = { type: 'missing', id: -1 };
  public expression_error = false;

  public type = 'spreadsheet-vertex'; // for type guard

  get array_head(){
    if (!this.address) return null;
    return this.reference
      && this.reference.area
      && this.reference.area.start.column === this.address.column
      && this.reference.area.start.row === this.address.row;

  }

  /**
   * sets dirty. this propagates. @see Calculate.
   *
   * NOTE: DO NOT CALL THIS. call the graph method, which updates the
   * dirty list.
   *
   * Q: so why is it here at all? why not have graph do the propagation?
   * edges are public, so there's no encapsulation problem. and if we're
   * doing propagation, why are edges public?
   *
   */
  public SetDirty() {

    // if we are already dirty, then our children are already
    // dirty and we can skip this.

    if (this.dirty) return;

    // otherwise set flag and propagate

    this.dirty = true;

    // special case: if there's a loop, we don't want to propagate

    // ...

    // otherwise propagate

    this.edges_out.forEach((edge) => (edge as SpreadsheetVertex).SetDirty());

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
   * - does not remove the entry from the dirty list (but does set the
   *   internal dirty flag).
   *
   * so the caller needs to explicitly address the dirty and volatile lists
   * for this vertex.
   */
  public TakeReferenceValue() {
    if (this.reference) {
      this.result = this.reference.GetValue();
    }
    this.dirty = false;
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
  public Calculate(
    graph: any, // any? because circular reference? (...)
    callback: (vertex: SpreadsheetVertex) => CalculationResult,
    spread_callback: (vertex: SpreadsheetVertex, value: any) => void){

    if (!this.dirty) return;

    // this is done before checking if it's a formula for the case of
    // arrays: arrays are not formulae but they are dependent on the
    // array head. if the head is dirty we need to calculate that before
    // any dependents of _this_ cell are calculated.

    // the head calculation should take care of setting this value, that is,
    // we don't need to do the actual lookup.

    if (this.edges_in.some((edge) => (edge as SpreadsheetVertex).dirty)) return;

    // we won't have a reference if the reference is to an empty cell,
    // so check that.

    if (this.reference) {

      if (this.reference.type === ValueType.formula) {
        const result = callback.call(graph, this);
        this.result = result.value;
        if (result.volatile) graph.volatile_list.push(this);
      }
      else this.result = this.reference.GetValue();

      if (this.array_head) {
        spread_callback.call(graph, this, this.result);
      }
      else if (this.reference.type === ValueType.formula) {
        if (typeof this.result === 'object' && this.result.error) {
          this.reference.SetCalculationError(this.result.error);
        }
        else this.reference.SetCalculatedValue(this.result);
      }

    }
    else {
      console.info('skip dirty constant?');
    }

    this.dirty = false;

    for (const edge of this.edges_out){
      (edge as SpreadsheetVertex).Calculate(graph, callback, spread_callback);
    }

  }

}
