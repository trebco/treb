
import { Area, type IArea } from 'treb-base-types';
import { type GraphCallbacks, SpreadsheetVertexBase } from './spreadsheet_vertex_base';
import { SpreadsheetVertex } from './spreadsheet_vertex';
import { Color } from './vertex';

import type { Cell, CellValue, ICellAddress, UnionValue } from 'treb-base-types';
import { Box, ValueType } from 'treb-base-types';
import type { ExpressionUnit } from 'treb-parser';
import { ErrorType } from '../function-error';

export enum SpreadsheetError {
  None,
  CalculationError,
}

export class SegmentVertex extends SpreadsheetVertexBase {

  public static type = 'segment';
  public type = SegmentVertex.type;

  private _quadrants?: SegmentVertex[] = undefined;

  public area: IArea;

  // public leaf?: SpreadsheetVertex; // FIXME: merge

  public constructor(area: IArea) {
    super();
    this.area = {
      start: {
        ...area.start
      }, 
      end: {
        ...area.end
      }
    };
  }

  // --- new flag --------------------------------------------------------------

  public is_leaf = false;

  // --- from old spreadsheet vertex -------------------------------------------

  public reference?: Cell;

  public error = SpreadsheetError.None;

  // why is this (?)? can't we use a default junk address?
  public address?: ICellAddress;

  //public result: UnionOrArray = UndefinedUnion();
  public result: UnionValue = {type: ValueType.undefined};

  public expression: ExpressionUnit = { type: 'missing', id: -1 };
  public expression_error = false;
  public short_circuit = false;

  // --- new method ------------------------------------------------------------

  /** 
   * unset flag and remove any data, to prevent hanging dependencies 
   */
  public ResetLeaf() {
    this.is_leaf = false;
    this.address = undefined;
    this.reference = undefined;
    this.result = { type: ValueType.undefined };
    this.expression = { type: 'missing', id: -1 };
    this.expression_error = false;
    this.short_circuit = false;
  }

  public get quadrants(): SegmentVertex[] {

    if (this._quadrants) {
      return this._quadrants;
    }

    const mid_row = Math.floor((this.area.start.row + this.area.end.row) / 2);
    const mid_column = Math.floor((this.area.start.column + this.area.end.column) / 2);

    this._quadrants = [];

    const start = this.area.start;
    const end = this.area.end;

    let node = new SegmentVertex({ 
      start: { 
        row: start.row, 
        column: start.column,
        sheet_id: start.sheet_id,
      },
      end: { 
        row: mid_row, 
        column: mid_column,
      }});
    this._quadrants[0] = node;
    node.edges_out.add(this);
    this.edges_in.add(node);

    node = new SegmentVertex({ 
      start: { 
        row: start.row, 
        column: mid_column + 1,
        sheet_id: start.sheet_id,
      },
      end: { 
        row: mid_row, 
        column: end.column,
      }});
    this._quadrants[1] = node;
    node.edges_out.add(this);
    this.edges_in.add(node);

    node = new SegmentVertex({ 
      start: { 
        row: mid_row + 1, 
        column: start.column,
        sheet_id: start.sheet_id,
      },
      end: { 
        row: end.row, 
        column: mid_column,
      }});
    this._quadrants[2] = node;
    node.edges_out.add(this);
    this.edges_in.add(node);

    node = new SegmentVertex({ 
      start: { 
        row: mid_row + 1, 
        column: mid_column + 1,
        sheet_id: start.sheet_id,
      },
      end: { 
        row: end.row, 
        column: end.column,
      }});
    this._quadrants[3] = node;
    node.edges_out.add(this);
    this.edges_in.add(node);

    return this._quadrants;

  }

  // --- spreadsheet vertex methods --------------------------------------------


  /** 
   * it seems like this could be cached, if it gets checked a lot 
   * also what's with the crazy return signature? [fixed]
   */
  get array_head(): boolean {
    if (!this.address) return false;
    return (!!this.reference)
      && (!!this.reference.area)
      && (this.reference.area.start.column === this.address.column)
      && (this.reference.area.start.row === this.address.row);

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
  public TakeReferenceValue(): void {
    if (this.reference) {
      this.result = Box(this.reference.GetValue());
    }
  }

  /**
   * once we populate a spill array, we need to follow edges
   * to dirty nodes and recalculate. watch out for loops, though
   * 
   * @returns expanded list, or false if we detect a loop
   */
  public ExpandEdgeList(source: SpreadsheetVertex, list: SpreadsheetVertex[]): SpreadsheetVertex[] | false {

    const expanded: SpreadsheetVertex[] = [...list];
    const queue: SpreadsheetVertex[] = [...list];

    while (queue.length > 0) {
      const entry = queue.shift();
      if (entry) {
        for (const edge of entry.edges_out.values()) {
          if (edge as SpreadsheetVertex === source) {
            console.info("== source");
            return false;
          }
          expanded.push(edge as SpreadsheetVertex);
          queue.push(edge as SpreadsheetVertex);
        }
      }
    }

    return expanded;
  }

  // --- composite calculation routine -----------------------------------------

  public Calculate(graph: GraphCallbacks): void {

    if (!this.dirty) {
      return;
    }

    if (this.GetColor(graph.epoch) === Color.white && this.LoopCheck(graph.epoch)) {
      this.dirty = false;

      if (this.edges_in.size) {

        if (this.is_leaf && 
            this.reference && (
            this.array_head || this.reference.type === ValueType.formula )) {
          this.reference.SetCalculationError(ErrorType.Loop);
        }

        graph.loop_errors++;

      }

      // intuitively this seems like a good idea but I'm not sure
      // that it is actually necessary (TODO: check)

      for (const edge of this.edges_out){
        (edge as SpreadsheetVertex).Calculate(graph);
      }

      return;

    }

    for (const edge of this.edges_in) {
      if ((edge as SpreadsheetVertexBase).dirty) {
        return;
      }
    }

    if (this.is_leaf && this.reference) {

      if (this.reference.type === ValueType.formula) {

        this.short_circuit = false;
        const result = graph.CalculationCallback.call(graph, this);

        // console.info("RX", result);

        this.result = result.value;

        // this test is a waste for 99% of calls 
        //
        // [FYI it has to do with dynamic dependencies, needs to be documented]
        //
        if (this.short_circuit) { return; } // what about setting dirty flag? (...)

        // and this one for ~75%?
        if (result.volatile) graph.volatile_list.push(this);
      }
      else this.result = this.reference.GetValue4();

      // is this going to work properly if it's an error? (...)

      if (this.array_head) {
        graph.SpreadCallback.call(graph, this, this.result);
      }
      else if (this.reference.type === ValueType.formula) {

        // adding check for spill, not withstanding the below

        if (this.result.type === ValueType.array) {

          // note array of length 1 should not trigger spill behavior
          // (moved to callback method)

          // the return value here (recalc) is the list of updated cells.
          // not sure if we're properly handling cells that _were_ part
          // of the spill but are no longer. we might need to track the 
          // original value for that (TODO/FIXME)

          const recalc = graph.SpillCallback.call(graph, this, this.result);
          if (recalc) {

            // set everyone dirty first, then recalculate. the aim is to 
            // avoid extra recalcs if a cell is based on two inputs that
            // change (although that's unlikely here...)

            const recalc_list: SpreadsheetVertex[] = [];
           
            for (const entry of (recalc as SpreadsheetVertex[])) {

              const expanded = this.ExpandEdgeList(this, Array.from(entry.edges_out.values()) as SpreadsheetVertex[]);
              if (expanded === false) {
                throw new Error('loop');
              }

              for (const edge of expanded) {
                edge.dirty = true;
                recalc_list.push(edge);
              }

              /*
              // will this work properly with loops? (...)

              for (const edge of entry.edges_out) {

                // I think this is the problem. we're setting out edges
                // on this vertex dirty but not following the graph after
                // that

                (edge as SpreadsheetVertex).dirty = true;
                (edge as SpreadsheetVertex).Calculate(graph);
              }
              */

            }

            for (const edge of recalc_list) {
              if (edge.dirty) {
                edge.Calculate(graph);
              }
            }

          }

        }
        else {

          // ---


          // data should now be clean when it gets here (famous last words)

          // we're now sometimes getting 0-length arrays here. that's a 
          // function of our new polynomial methods, BUT, we should probably
          // handle it properly regardless.

          // neven // const single = (this.result.type === ValueType.array) ? this.result.value[0][0] : this.result;

          // we are using object type in the returned value for sparklines...
          // so we can't drop it here. we could change rendering though. or
          // whitelist types. or blacklist types. or something.

          this.reference.SetCalculatedValue(this.result.value as CellValue, this.result.type);

        }
      }

    }
    
    this.dirty = false;

    for (const edge of this.edges_out as Set<SpreadsheetVertexBase>){
      if (edge.dirty) {
        graph.calculation_list.push(edge);
      }
    }
    
  }
  
}