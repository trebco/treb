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

import type { Vertex} from './vertex';
import { SpreadsheetVertex  } from './spreadsheet_vertex';
import type { SpreadsheetVertexBase, CalculationResult, GraphCallbacks } from './spreadsheet_vertex_base';
import type { StateLeafVertex } from './state_leaf_vertex';
import type { ICellAddress, ICellAddress2, IArea, UnionValue } from 'treb-base-types';
import { Area } from 'treb-base-types';
import type { DataModel } from 'treb-data-model';
import { CalculationLeafVertex } from './calculation_leaf_vertex';

import { AreaUtils } from 'treb-base-types';
import { IntervalVertex } from './interval-vertex';

export type LeafVertex = StateLeafVertex|CalculationLeafVertex;
export type { StateLeafVertex };

// FIXME: this is a bad habit if you're testing on falsy for OK.

export enum GraphStatus {
  OK = 0,
  Loop,
  CalculationError,
}

const MAX_ROWS = 2**20;
const MAX_COLS = 2**14;

const ROOT_AREA: IArea = {
  start: { 
    row: 0, 
    column: 0,
  }, 
  end: { 
    row: MAX_ROWS - 1, 
    column: MAX_COLS - 1,
  },
};

export function IsIntervalVertex(vertex: Vertex): vertex is IntervalVertex {
  return vertex.type === IntervalVertex.type;
}

export function IsSpreadsheetVertex(vertex: Vertex): vertex is SpreadsheetVertex {
  return vertex.type === SpreadsheetVertex.type || 
    (vertex.type === IntervalVertex.type && (vertex as IntervalVertex).is_leaf);
}

/**
 * graph is now abstract, as we are extending it with the calculator.
 */
export abstract class Graph implements GraphCallbacks {

  /**
   * root of segment tree, per sheet
   */
  public roots: Map<number, IntervalVertex> = new Map();

  /** list of vertices that are volalite (dirty on every recalc) */
  public volatile_list: SpreadsheetVertexBase[] = [];

  /** epoch for managing colors, so we don't have to wipe the list */
  public epoch = 0;

  /** 
   * temp reporting for loop errors, since we no longer have a global
   * method to do the check. we should use a list or something so we
   * can have some debug information
   */
  public loop_errors = 0;

  /**
   * this is a global list of cells that need calculation. it's initialized
   * in the calculation loop, but then can be appended by individual vertices
   * during the calculation. FIXME: just make this a temporary field, you 
   * can pass it to the calculation method.
   */
  public calculation_list: SpreadsheetVertexBase[] = [];

  public spill_data: { area: IArea, vertex: StateLeafVertex }[] = [];

  protected abstract readonly model: DataModel;

  /**
   * where is the loop in the graph (or at least the first one we found)?
   */
  public loop_hint?: string;

  // special
  public leaf_vertices: Set<LeafVertex> = new Set();

  /** lock down access */
  private dirty_list: SpreadsheetVertexBase[] = [];

  /** flag set on add edge */
  private loop_check_required = false;

  /**
   * flush the graph, calculation tree and cells reference
   */
  public FlushTree(): void {
    this.dirty_list = [];
    this.volatile_list = [];
    this.leaf_vertices.clear(); 
    this.roots.clear();

    // can we flush spills here without cleaning up? (...)
  }

  public ResolveArrayHead(address: ICellAddress): ICellAddress {

    if (!address.sheet_id) { throw new Error('resolve array head with no sheet id'); }
    const cells = this.model.sheets.Find(address.sheet_id)?.cells;

    if (!cells) {
      throw new Error('no cells? sheet id ' + address.sheet_id);
    }

    const row = cells.data[address.row];
    if (row) {
      const cell = row[address.column];
      if (cell && cell.area) {

        const resolved = { row: cell.area.start.row, column: cell.area.start.column, sheet_id: address.sheet_id };
        console.info('array head', address, resolved);

        return resolved;

      }
    }

    return address;

  }

  /** return or create root for the given sheet, by id */
  public EnsureRoot(sheet: number) {
    let root = this.roots.get(sheet);
    if (!root) {
      root = new IntervalVertex(ROOT_AREA);
      this.roots.set(sheet, root);
    }
    return root;
  }

  /** overload */
  public GetVertex(address: ICellAddress, create: true): SpreadsheetVertex;

  /** overload */
  public GetVertex(address: ICellAddress, create?: boolean): SpreadsheetVertex | undefined;

  /** returns the vertex at this address. creates it if necessary. */
  public GetVertex(address: ICellAddress, create?: boolean): SpreadsheetVertex | undefined {

    if (!address.sheet_id) { 
      console.info(JSON.stringify({address, create}));
      console.trace();
      throw new Error('getvertex with no sheet id'); 
    }

    const cells = this.model.sheets.Find(address.sheet_id)?.cells;

    if (!cells) {
      throw new Error('no cells? sheet id ' + address.sheet_id);
    }

    const intervals = this.GetIntervals(new Area(address), this.EnsureRoot(address.sheet_id));

    if (intervals.length !== 1) {
      throw new Error('invalid interval size: ' + intervals.length);
    }
    const vertex = intervals[0] as IntervalVertex;

    if (vertex.is_leaf) {
      return vertex;
    }

    if (!create) {
      return undefined;
    }
    
    vertex.is_leaf = true;

    // vertex.address = { ...address };

    // because we are passing in something other than an address, we're 
    // collecting a lot of extraneous data here. I am worried that someone
    // is relying on it, so we will force it to be just the address props.
    // see if something breaks.

    vertex.address = {
      row: address.row,
      column: address.column,
      absolute_row: address.absolute_row,
      absolute_column: address.absolute_column,
      sheet_id: address.sheet_id,
    };

    // this breaks if the cell reference does not point to a cell; that
    // happens if a formula references an empty cell, and we run through
    // a serialize/unserialize pass.

    // FIXME: ensuring the cell will work, but that seems like unecessary
    // work; is there a way we can just let this reference dangle? the only
    // thing we need to worry about is maintaining the dependency, so if the
    // cell _is_ created later we get the update. (...)

    // FIXME: the above is not working. recall the BSM model. we had
    // 
    // =IF(C3, C3, C4 + x)
    //
    // with no value in C3. as a result if you type something in, it won't
    // update because there's no bound reference. we can ensure the cell,
    // but maybe there's way to get it to work without that.

    // I think the reason is because the reference lookup is closed by
    // the calc routine; so dirty doesn't do it. let's ensure cell, for now.

    /*
    // works ok, maybe a little verbose

    const row = cells.data2[address.row];
    if (row) {
      const cell = row[address.column];
      if (cell) {
        vertex.reference = cell;
      }
    }
    */

    vertex.reference = cells.EnsureCell(address);
    return vertex;

  }

  public RemoveVertexLeaf(vertex: Vertex) {
    if (!IsSpreadsheetVertex(vertex)) {
      return;
    }

    if (IsIntervalVertex(vertex)) {
      vertex.ResetLeaf();
    }
    else {
      console.warn('spreadsheet vertex type? unxpected');
    }

  }

  /** deletes the vertex at this address. */
  public RemoveVertex(address: ICellAddress): void {

    console.info("REMOVED TEMP (100)")

    /*
    if (!address.sheet_id) { throw new Error('removevertex with no sheet id'); }

    const vertex = this.GetVertex(address, false);
    if (!vertex) return;

    vertex.Reset();

    this.vertex_map.delete(AddressKey(address));
    */

    // this.vertices[address.sheet_id][address.column][address.row] = undefined;
    // ArrayVertex2.CheckOutbound();

  }

  /*
  public RemoveHyperVertex(vertex: HyperVertex) {

    const dependencies = Array.from(vertex.edges_in);
    vertex.Reset();

    for (const dependency of dependencies) {

      // at the moment these are only spreadsheet vertices. but the whole
      // point of this is to change that... so we'll need to handle the case
      // eventually

      if (IsHyperVertext(dependency)) {

        // ...

      }
      else if (IsSpreadsheetVertex(dependency)) {
        if (!dependency.has_inbound_edges && !dependency.has_outbound_edges) {
          const target = (dependency as SpreadsheetVertex);
          if (target.address) {
            this.RemoveVertex(target.address);
          }
        }        
      }

    }

    if (vertex.area) {
      this.hypervertex_list.delete(AreaKey(vertex.area))
    }

  }
  */

  /** removes all edges, for rebuilding. leaves value/formula as-is. */
  public ResetVertex(address: ICellAddress): void {
    const vertex = this.GetVertex(address, false);
    if (vertex) vertex.Reset();
  }

  public RIBcount = 0;

  /**
   * resets the vertex by removing inbound edges and clearing formula flag.
   * we have an option to set dirty because they get called together
   * frequently, saves a lookup.
   */
  public ResetInbound(address: ICellAddress, set_dirty = false, create = true, remove = false): void {

    this.RIBcount++; // what is this, a diagnostic?
    
    const vertex = this.GetVertex(address, create);

    // console.info("RIB", address.row, address.column, 'd?', set_dirty, vertex, 'R?', remove);

    if (!vertex || !(vertex as IntervalVertex).is_leaf) {
      /*
      if (set_dirty) {
        const list = ArrayVertex.GetContainingArrays(address as ICellAddress2);
        for (const entry of list) {
          this.SetVertexDirty(entry);
        }
      }
      */
      return;
    }

    // this vertexes' dependencies might only have one outbound edge 
    // (to this); in that case, we could remove the dependency vertex, 
    // since it is essentially orphaned

    let dependencies: Vertex[] = [];

    // do this conditionally so we avoid the slice if unecessary

    if (remove) {
      dependencies = Array.from(vertex.edges_in);
    }

    // at this point we know this is a leaf, so this is safe... right?

    vertex.ClearDependencies();

    if (set_dirty) {
      this.SetVertexDirty(vertex);
    }
   
    // this probably should not happen unless there are no dependents/outbound edges? (...)

    if (remove) {

      // note: this function can never get called with a hypervertex, 
      // because it gets called from the calculator. `vertex` will always 
      // be a spreadsheet vertex.

      // there could be a hypervertex in the dependencies, though.

      if (!vertex.has_outbound_edges) {
        // this.RemoveVertex(address);
        this.RemoveVertexLeaf(vertex);
      }

      for (const dependency of dependencies) {
        if (!dependency.has_inbound_edges && !dependency.has_outbound_edges) {
          const target = (dependency as SpreadsheetVertex);
          if (target.address) {
            // this.RemoveVertex(target.address);
            this.RemoveVertexLeaf(target); 
          }
        }
      }

    }

  }

  /**
   * update the epoch so cycle checks will run on the next calculation
   */
  public ResetLoopState(): void {
    this.epoch++;
  }

  /**
   * render address as string; this is for reporting loops
   */
  public RenderAddress(address?: ICellAddress): string {

    if (!address) { return 'undefined'; }

    let sheet_name = '';
    if (address.sheet_id) {
      const sheet = this.model.sheets.Find(address.sheet_id);
      if (sheet) {
        sheet_name = sheet.name + '!';
      }
    }

    const area = new Area(address);
    return sheet_name + area.spreadsheet_label;
    
  }

  public GetIntervals(area: Area, current?: IntervalVertex): IntervalVertex[] {
   
    if (!current) {
      current = this.EnsureRoot(area.start.sheet_id||0);
    }

    // console.info("GI", current.area.spreadsheet_label, current === this.root_interval ? '(root)': '');

    // no overlap
    if (current.area.end.row < area.start.row || 
        current.area.start.row > area.end.row || 
        current.area.end.column < area.start.column || 
        current.area.start.column > area.end.column) {
      return [];
    }

    // full cover
    if (current.area.start.row >= area.start.row && 
        current.area.end.row <= area.end.row && 
        current.area.start.column >= area.start.column && 
        current.area.end.column <= area.end.column) {

      // console.info(' full cover', current.area.spreadsheet_label, area.spreadsheet_label);

      return [current];
    }

    // partial cover: split down row & col midpoints
    const mid_row = Math.floor((current.area.start.row + current.area.end.row) / 2);
    const mid_column = Math.floor((current.area.start.column + current.area.end.column) / 2);

    const result: IntervalVertex[] = [];

    const ProcessQuadrant = (
      quadrant: 0|1|2|3,
      sub_area: IArea,
    ) => {

      if (sub_area.start.row > sub_area.end.row || sub_area.start.column > sub_area.end.column) {
        return;
      }

      let node = current.quadrants[quadrant];

      if (!node) {
        node = new IntervalVertex(sub_area);
        current.quadrants[quadrant] = node;
        node.edges_out.add(current);
        current.edges_in.add(node);
      }

      const nodes = this.GetIntervals(area, node);
      result.push(...nodes);

    };

    // recurse into valid non-empty quadrants

    ProcessQuadrant(0, { 
      start: { 
        row: current.area.start.row, 
        column: current.area.start.column,
      },
      end: { 
        row: mid_row, 
        column: mid_column,
      }
    });

    ProcessQuadrant(1, { 
      start: { 
        row: current.area.start.row, 
        column: mid_column + 1,
      },
      end: { 
        row: mid_row, 
        column: current.area.end.column,
      }
    });

    ProcessQuadrant(2, { 
      start: { 
        row: mid_row + 1, 
        column: current.area.start.column,
      },
      end: { 
        row: current.area.end.row, 
        column: mid_column,
      }
    });

    ProcessQuadrant(3, { 
      start: { 
        row: mid_row + 1, 
        column: mid_column + 1,
      },
      end: { 
        row: current.area.end.row, 
        column: current.area.end.column,
      }
    });
    
    return result;

  }

  public AddLeafVertexAreaEdge(u: Area, vertex: LeafVertex) {
    const intervals = this.GetIntervals(u);
    for (const interval of intervals) {
      vertex.DependsOn(interval);
    }
  }

  public AddAreaEdge(u: Area, v: ICellAddress): void {

    const v_v = this.GetVertex(v, true);
    const intervals = this.GetIntervals(u);

    // console.info("intervals", {intervals});

    for (const interval of intervals) {
      v_v.DependsOn(interval);
    }

    this.loop_check_required = true;

  }

  /** adds an edge from u -> v */
  public AddEdge(u: ICellAddress, v: ICellAddress, /* tag?: string */ ): void {

    const v_u = this.GetVertex(u, true);
    const v_v = this.GetVertex(v, true);

    // seems pretty uncommon, not sure it's a useful optimization
    // const already_connected = v_u.edges_out.includes(v_v);
    // if (already_connected) 
    
    // console.info('add edge', u.sheet_id, u.row, u.column, '<-', v.sheet_id, v.row, v.column, tag||'')

    // const status = this.LoopCheck(v_v, v_u);
    // if (status === GraphStatus.Loop) { return status; }

    v_v.DependsOn(v_u);

    // add implicit edge to array head. this is required at start
    // because the array isn't set implicitly (why not?)

    // watch out for missing sheet ID!

    if (v_u.reference && v_u.reference.area && !v_u.array_head) {

      // console.info('add implicit edge -> array head (?), u', u, ', v', v);

      // the old version added an implicit edge from array head -> array
      // member, not sure why that was a good idea (or why it doesn't work);
      // add an implicit edge -> v instead... 
      // 
      // maybe we thought it was a good idea because it would consolidate 
      // all the edges through the member? you still get edges, though...

      this.AddEdge({
        ...u,
        row: v_u.reference.area.start.row,
        column: v_u.reference.area.start.column,
      }, v); // , 'implicit');
    }

    this.loop_check_required = true; // because new edges

  }

  /** removes edge from u -> v */
  public RemoveEdge(u: ICellAddress, v: ICellAddress): void {

    const v_u = this.GetVertex(u, false);
    const v_v = this.GetVertex(v, false);

    if (!v_u || !v_v) return;

    v_u.RemoveDependent(v_v);
    v_v.RemoveDependency(v_u);

  }

  /** set dirty, using vertex as base interface */
  public SetVertexDirty(vertex: SpreadsheetVertexBase): void {

    // see below re: concern about relying on this

    if (vertex.dirty) { return; }

    this.dirty_list.push(vertex);
    vertex.dirty = true;

    // this is backwards but we need to do it this way for now
    const address = (vertex as SpreadsheetVertex).address;
    if (address) {
      const intervals = this.GetIntervals(new Area(address));
      if (intervals.length !== 1) {

        // console.info('intervals len', intervals.length);
        // console.info({vertex});

        // throw new Error('INVALID LEN');
      }

      for (const interval of intervals) {
        // const first = intervals[0] as IntervalVertex;
        // this.SetVertexDirty(first);
        this.SetVertexDirty(interval);
      }
    }
    
    for (const edge of vertex.edges_out) {
      this.SetVertexDirty(edge as SpreadsheetVertexBase);
    }

  }

  /** set dirty, using address as base interface */
  public SetDirty(address: ICellAddress): void {

    // console.info("SD", address);

    const vertex = this.GetVertex(address, true);
    this.SetVertexDirty(vertex);

  }

  // --- leaf vertex api ---

  /**
   * adds a leaf vertex to the graph. this implies that someone else is
   * managing and maintaining these vertices: we only need references.
   */
  public AddLeafVertex(vertex: LeafVertex): void {

    /*
    if (this.leaf_vertices.has(vertex)) {
      console.info("TLV already has", vertex);
    }
    */

    this.leaf_vertices.add(vertex); 
  }

  /** removes vertex */
  public RemoveLeafVertex(vertex: LeafVertex): void {

    // this does not remove edges? seems sloppy

    vertex.Reset(); // testing

    this.leaf_vertices.delete(vertex);
  }

  /**
   * adds an edge from u -> v where v is a leaf vertex. this doesn't use
   * the normal semantics, and you must pass in the actual vertex instead
   * of an address.
   *
   * there is no loop check (leaves are not allowed to have outbound
   * edges).
   */
  public AddLeafVertexEdge(u: ICellAddress, v: LeafVertex): GraphStatus {
    const v_u = this.GetVertex(u, true);
    v.DependsOn(v_u);
    return GraphStatus.OK;
  }

  /** removes edge from u -> v */
  public RemoveLeafVertexEdge(u: ICellAddress, v: LeafVertex): void {
    const v_u = this.GetVertex(u, false);

    if (!v_u) return;

    v_u.RemoveDependent(v);
    v.RemoveDependency(v_u);

  }

  // --- for initial load ---

  public InitializeGraph(): void {

    for (const vertex of this.dirty_list) {

      // take reference values for spreadsheet vertices

      if (IsSpreadsheetVertex(vertex)) {
        vertex.TakeReferenceValue();
        if (this.CheckVolatile(vertex)) {
          this.volatile_list.push(vertex);
        }
      }

      // clear dirty flag on _all_ vertices

      vertex.dirty = false;

    }

    // reset, essentially saying we're clean

    this.dirty_list = [];

  }

  // --- calculation ---

  /** runs calculation */
  public Recalculate(): void {


    // FIXME: volatiles should proabbly be calculated first,
    // not last, because they're probably primary.

    // we do this using the local function so we can trace back arrays.
    // be sure to do this _before_ checking spills

    for (const vertex of this.volatile_list) {
      this.SetVertexDirty(vertex as SpreadsheetVertex);
    }
    

    ////////////////////////////////////////

    // (moving this up so it comes before we slice the dirty list)

    // the problem with flushing all the spills here
    // is that if we're not calculating a range that
    // intersects with the spill, it will disappear.
    // options are (1) to dirty the spill root, so it
    // calculates, or (2) to check for intersection.

    // checking for intersection might work because 
    // we should have vertices and they should be marked
    // as dirty...

    // eh that's not going to work, because edges point
    // the wrong way. if you edit a cell within a spill 
    // range, it won't dirty the spill source because
    // the edge goes from spill source -> spill cell.

    // we could create a special leaf vertex to watch the 
    // range. or we could just check here. vertices is 
    // more elegant (and more memory), this is clumsier (and 
    // more calc). 
    
    this.spill_data = this.spill_data.filter(({area, vertex}) => {
      if (vertex.dirty) {
        vertex.Reset(); 
        const cells = area.start.sheet_id ? this.model.sheets.Find(area.start.sheet_id)?.cells : undefined;
        if (cells) {
          for (const {cell, row, column} of cells.IterateRC(new Area(area.start, area.end))) {
            if (cell.spill) {
              cell.spill = undefined;
              if (typeof cell.value === 'undefined') {
                cell.Reset();
              }
            }

            // this is necessary for non-head cells in case the cell has deps
            this.SetDirty({row, column, sheet_id: area.start.sheet_id});

          }
          // this.SetDirty(area.start);
        }
        return false; // drop
      }
      return true; // keep
    });

    //////////////////////////////////////////

    this.calculation_list = this.dirty_list.slice(0);

    // console.info("CL", this.calculation_list);

    this.volatile_list = [];
    this.dirty_list = [];

    if (this.loop_check_required) {
      this.ResetLoopState();
      this.loop_check_required = false;
    }

    this.loop_errors = 0;

    // console.info("CL", calculation_list)

    // recalculate everything that's dirty. FIXME: optimize path
    // so we do fewer wasted checks of "are all my deps clean"?

    // for (const vertex of calculation_list) {
    //  vertex.Calculate(this);
    //}

    for (let i = 0; i < this.calculation_list.length; i++) {
      this.calculation_list[i].Calculate(this);
    }

    this.calculation_list = [];

  }

  public abstract CalculationCallback(vertex: SpreadsheetVertexBase): CalculationResult;
  public abstract SpreadCallback(vertex: SpreadsheetVertexBase, value: UnionValue): void;
  public abstract SpillCallback(vertex: SpreadsheetVertexBase, value: UnionValue): void;
  protected abstract CheckVolatile(vertex: SpreadsheetVertex): boolean;

}
