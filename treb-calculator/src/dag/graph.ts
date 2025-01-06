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
 * Copyright 2022-2025 trebco, llc. 
 * info@treb.app
 * 
 */

import type { Vertex} from './vertex';
import { Color } from './vertex';
import { SpreadsheetVertex  } from './spreadsheet_vertex';
import { ArrayVertex  } from './array-vertex';
import type { SpreadsheetVertexBase, CalculationResult, GraphCallbacks } from './spreadsheet_vertex_base';
import type { StateLeafVertex } from './state_leaf_vertex';
import type { ICellAddress, ICellAddress2, IArea, UnionValue } from 'treb-base-types';
import { Area } from 'treb-base-types';
import type { DataModel } from 'treb-data-model';
import { CalculationLeafVertex } from './calculation_leaf_vertex';

import { AreaUtils } from 'treb-base-types';

export type LeafVertex = StateLeafVertex|CalculationLeafVertex;
export type { StateLeafVertex };

// FIXME: this is a bad habit if you're testing on falsy for OK.

export enum GraphStatus {
  OK = 0,
  Loop,
  CalculationError,
}

/**
 * graph is now abstract, as we are extending it with the calculator.
 */
export abstract class Graph implements GraphCallbacks {

  /**
   * list of vertices, indexed by address as [sheet id][column][row]
   */
  public vertices: Array<Array<Array<SpreadsheetVertex|undefined>>> = [[]];

  public volatile_list: SpreadsheetVertexBase[] = [];

  public calculation_list: SpreadsheetVertexBase[] = [];

  // list of spills we have created
  // public spills: IArea[] = [];
  public spill_data: { area: IArea, vertex: StateLeafVertex }[] = [];

  // public cells_map: {[index: number]: Cells} = {};

  protected abstract readonly model: DataModel;

  /**
   * where is the loop in the graph (or at least the first one we found)?
   */
  public loop_hint?: string;

  // special
  // public leaf_vertices: LeafVertex[] = [];
  public leaf_vertices: Set<LeafVertex> = new Set();

  /** lock down access */
  private dirty_list: SpreadsheetVertexBase[] = [];

  /** flag set on add edge */
  private loop_check_required = false;

  /*
  public IsArrayVertex(vertex: Vertex): vertex is ArrayVertex {
    return vertex.type === ArrayVertex.type;
  }
  */

  public IsSpreadsheetVertex(vertex: Vertex): vertex is SpreadsheetVertex {
    return vertex.type === SpreadsheetVertex.type;
  }

  /* *
   * we used to attach the data model here, but it's now an instance
   * property (and readonly). we map still need to rebuild the map, 
   * so we're retaining the method for the time being (but renamed and 
   * reparameterized).
   * 
   * if model were a class we wouldn't have to do this...
   * /
  protected RebuildMap(): void {
    this.cells_map = {};
    for (const sheet of this.model.sheets.list) {
      this.cells_map[sheet.id] = sheet.cells;
    }
  }
  */

  /**
   * flush the graph, calculation tree and cells reference
   */
  public FlushTree(): void {
    this.dirty_list = [];
    this.volatile_list = [];
    this.vertices = [[]];
    this.leaf_vertices.clear(); 
    // this.cells_map = {};

    // can we flush spills here without cleaning up? (...)
    // this.spills = [];

    /** array vertex maintains its own list */
    ArrayVertex.Clear();

  }

  public ResolveArrayHead(address: ICellAddress): ICellAddress {

    if (!address.sheet_id) { throw new Error('resolve array head with no sheet id'); }
    //const cells = this.cells_map[address.sheet_id];
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

  /**
   * iterate vertices
   * @param area 
   */
  public *IterateVertices(area: IArea, create = false): Generator<SpreadsheetVertex> {

    // this is wasteful because it repeatedly gets the cells, but
    // for a contiguous area we know they're in the same sheet. we
    // cal also skip the repeated tests. FIXME

    for (const address of AreaUtils.Iterate(area)) {
      const vertex = this.GetVertex(address, create);
      if (vertex) {
        yield vertex;
      }
    }
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

    // if (!this.cells) return undefined;

    //const cells = this.cells_map[address.sheet_id];
    const cells = this.model.sheets.Find(address.sheet_id)?.cells;

    if (!cells) {
      throw new Error('no cells? sheet id ' + address.sheet_id);
      return undefined;
    }

    if (!this.vertices[address.sheet_id]) {
      if (!create) {
        return undefined;
      }
      this.vertices[address.sheet_id] = [];
    }

    if (!this.vertices[address.sheet_id][address.column]) {
      if (!create) {
        return undefined;
      }
      this.vertices[address.sheet_id][address.column] = [];
    }
    else {
      const existing_vertex = this.vertices[address.sheet_id][address.column][address.row];
      if (existing_vertex) {
        return existing_vertex;
      }
      if (!create) return undefined;
    }

    const vertex = new SpreadsheetVertex();
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

    this.vertices[address.sheet_id][address.column][address.row] = vertex;

    // if there's an array that contains this cell, we need to create an edge

    // this.CreateImplicitEdgeToArrays(vertex);

    // this is back, in the new form

    ArrayVertex.CreateImplicitEdges(vertex, address as ICellAddress2);

    return vertex;

  }

  /** deletes the vertex at this address. */
  public RemoveVertex(address: ICellAddress): void {

    if (!address.sheet_id) { throw new Error('removevertex with no sheet id'); }

    const vertex = this.GetVertex(address, false);
    if (!vertex) return;

    vertex.Reset();
    this.vertices[address.sheet_id][address.column][address.row] = undefined;

    // ArrayVertex2.CheckOutbound();

  }

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

    this.RIBcount++;
    
    const vertex = this.GetVertex(address, create);

    // console.info("RIB", address.row, address.column, 'd?', set_dirty, vertex, 'R?', remove);

    if (!vertex) {
      if (set_dirty) {
        const list = ArrayVertex.GetContainingArrays(address as ICellAddress2);
        for (const entry of list) {
          this.SetVertexDirty(entry);
        }
      }
      return;
    }

    // this vertexes' dependencies might only have one outbound edge 
    // (to this); in that case, we could remove the dependency vertex, 
    // since it is essentially orphaned

    let dependencies: Vertex[] = [];

    // do this conditionally so we avoid the slice if unecessary

    if (remove) {
      // dependencies = vertex.edges_in.slice(0);
      dependencies = Array.from(vertex.edges_in);
    }

    vertex.ClearDependencies();

    if (set_dirty) {
      // this.dirty_list.push(vertex);
      // vertex.SetDirty();
      this.SetVertexDirty(vertex);
    }

    // vertex.expression = { type: 'missing', id: -1 };
    // vertex.expression_error = false;
    
    // this probably should not happen unless there are no dependents/outbound edges? (...)

    if (remove) {

      if (!vertex.has_outbound_edges) {
        this.RemoveVertex(address);
      }

      for (const dependency of dependencies) {
        if (!dependency.has_inbound_edges && !dependency.has_outbound_edges) {
          const target = (dependency as SpreadsheetVertex);
          if (target.address) {
            this.RemoveVertex(target.address);
          }
        }
      }

      /*
      if (vertex?.has_outbound_edges) {
        console.info('(NOT) removing a vertex with outbound edges...')
      }
      else {
        console.info('removing a vertex')
        this.RemoveVertex(address);
      }
      */

    }

  }

  /* * dev * /
  public ForceClean() {
    for (const l1 of this.vertices) {
      if (l1) {
        for (const l2 of l1) {
          if (l2) {
            for (const vertex of l2) {
              if (vertex && vertex.dirty) {
                vertex.dirty = false;
              }
            }
          }
        }
      }
    }

  }

  / * * dev, check if any vertices are dirtices * /
  public CheckDirty() {

    for (const l1 of this.vertices) {
      if (l1) {
        for (const l2 of l1) {
          if (l2) {
            for (const vertex of l2) {
              if (vertex && vertex.dirty) {
                console.info("DIRTY", `R${vertex.address?.row} C${vertex.address?.column}`, vertex);


              }
            }
          }
        }
      }
    }
    
  }
  */

  /**
   * reset all vertices. this method is used so we can run the loop check
   * as part of the graph calculation, instead of requiring the separate call.
   */
  public ResetLoopState(): void {

    for (const l1 of this.vertices) {
      if (l1) {
        for (const l2 of l1) {
          if (l2) {
            for (const vertex of l2) {
              if (vertex) {
                // vertex.color = Color.white; 
                vertex.color = vertex.edges_out.size ? Color.white : Color.black;
              }
            }
          }
        }
      }
    }

    // this is unecessary

    for (const vertex of this.leaf_vertices) {
      vertex.color = Color.black;
    }
    
  }

  /**
   * global check returns true if there is any loop. this is more efficient
   * than detecting loops on every call to AddEdge. uses the color algorithm
   * from CLRS.
   * 
   * UPDATE we switched to a stack-based check because we were hitting 
   * recursion limits, although that seemed to only happen in workers -- 
   * perhaps they have different stack [in the malloc sense] sizes? in any 
   * event, I think the version below is now stable. 
   * 
   * @param force force a check, for dev/debug
   */
  public LoopCheck(force = false): boolean {

    // this flag is only set on AddEdge, and only cleared when we successfully
    // get through this function. so if there are no new edges, we can bypass.

    if (!this.loop_check_required && !force) { return false; }

    // vertices is array [][][]
    // build a list so we can simplify the second loop (waste of space?)

    const list: Vertex[] = [];

    for (const l1 of this.vertices) {
      if (l1) {
        for (const l2 of l1) {
          if (l2) {
            for (const vertex of l2) {
              if (vertex) { 
                vertex.color = vertex.edges_out.size ? Color.white : Color.black;
                list.push(vertex);
              }
            }
          }
        }
      }
    }

    // we were having problems with large calculation loops (basically long
    // lists of x+1) using a recursive DFS. so we need to switch to a stack,
    // just in case, hopefully it won't be too expensive.

    // ---

    // unwind recursion -> stack. seems to work OK. could we not just 
    // use the list as the initial stack? (...)
    
    // NOTE: I think this method is bugged. I'm fixing it in the vertex
    // version of the loop check routine (because we don't use this anymore)
    // but if this ever comes back it needs to be fixed.

    const stack: Vertex[] = [];

    for (const vertex of list) {
      if (vertex.color === Color.white) {

        vertex.color = Color.gray; // testing
        stack.push(vertex);

        while (stack.length) {

          // so leave it on the stack until we're done. we may "recurse", in
          // which case we need to come back to this item when the children
          // have been handled. we will wind up looping again, so there are 
          // some wasted checks, although I'm not sure how to deal with that
          // without duplicating the edge list.

          // concept: stack is a list of [edge, skip = 0]
          // when processing an entry, do
          //
          // const x of (skip ? v.edges_out.slice(skip) : v.edges_out)
          //
          // or maybe be efficient and not fancy,
          // 
          // for (let i = skip; i < v.edges_out.length; i++)
          //
          // or what you should actually do is use the stack field as the loop
          // variable, so it persists. or put something in the vertex so it 
          // persists and applies to things that are placed on the stack more
          // than once. 

          const v = stack[stack.length - 1];
          let completed = true;

          if (v.color !== Color.black) {

            for (const edge of v.edges_out) {

              if (edge.color === Color.gray) {
                this.loop_hint = this.RenderAddress((vertex as SpreadsheetVertex).address);
                console.info('loop detected @', this.loop_hint);
                return true; // exit
              }
              else if (edge.color === Color.white) {

                // here we're pushing onto the stack, so these will be handled
                // next, but since v is still on the stack once those are done
                // we will hit v again. 

                // edge.color = Color.gray;
                stack.push(edge);
                completed = false;
              }

            }

          }

          // if we have not pushed anything onto the stack (we have not 
          // recursed), then we can clean up; since the stack is still the 
          // same we can pop() now.

          if (completed) {
            stack.pop();
            v.color = Color.black; // v is complete, just in case we test it again
          }

        }

        // OK, tested and complete

        vertex.color = Color.black;

      }
    }

    /*

    const tail = (vertex: Vertex): boolean => {
      vertex.color = Color.gray;
      for (const edge of vertex.edges_out) {
        if (edge.color === Color.gray) { 
          this.loop_hint = this.RenderAddress((vertex as SpreadsheetVertex).address);
          console.info('loop detected @', this.loop_hint);
          return true; // loop
        }
        else if (edge.color === Color.white) {
          if (tail(edge)) {
            return true; // loop
          }
        }
      }
      vertex.color = Color.black;
      return false;
    };

    for (const vertex of list) {
      if (vertex.color === Color.white && tail(vertex)) { return true; }
    }
    */

    this.loop_check_required = false;
    this.loop_hint = undefined;

    return false;

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

      /*
      for (const sheet of this.model.sheets.list) {
        if (address.sheet_id === sheet.id) {
          sheet_name = sheet.name + '!';
          break;
        }
      }
      */

    }

    const area = new Area(address);
    return sheet_name + area.spreadsheet_label;
    
  }

  /** 
   * new array vertices
   */
  protected CompositeAddArrayEdge(u: Area, vertex: Vertex): void {

    if (!u.start.sheet_id) {
      throw new Error('AddArrayEdge called without sheet ID');
    }

    // create or use existing
    const [array_vertex, created] = ArrayVertex.GetVertex(u);

    // add an edge
    vertex.DependsOn(array_vertex);

    // force a check on next calculation pass
    this.loop_check_required = true;

    if (!created) {
      // console.info('reusing, so not adding edges');
      return;
    }

    // now add edges from/to nodes THAT ALREADY EXIST

    // range can't span sheets, so we only need one set to look up

    const map = this.vertices[u.start.sheet_id];

    // console.info({u});

    // this might happen on create, we can let it go because the 
    // references will be added when the relevant sheet is added

    if (!map) {
      return;
    }

    // ...

    if (u.entire_row) {
      // console.group('entire row(s)')
      for (let column = 0; column < map.length; column++) {
        if (map[column]) {
          for (let row = u.start.row; row <= u.end.row; row++ ) {
            const vertex = map[column][row];
            if (vertex) {
              // console.info('add', column, row);
              array_vertex.DependsOn(vertex);
            }
          }
        }
      }
      // console.groupEnd();
    }
    else if (u.entire_column) {
      // console.group('entire column(s)');
      for (let column = u.start.column; column <= u.end.column; column++) {
        if(map[column]) {
          for (const vertex of map[column]) {
            if (vertex?.address) {
              // console.info('add', vertex.address);
              array_vertex.DependsOn(vertex);
            }
          }
        }
      }
      // console.groupEnd();
    }
    else {
      for (let row = u.start.row; row <= u.end.row; row++) {
        for (let column = u.start.column; column <= u.end.column; column++) {
          if (map[column]) {
            const vertex = map[column][row];
            if (vertex) {
              array_vertex.DependsOn(vertex);
            }
          }
          /*
          else {
            console.info("HERE", column, row);
          }
          */
        }
      }
    }

  }

  public AddLeafVertexArrayEdge(u: Area, vertex: LeafVertex) {
    this.CompositeAddArrayEdge(u, vertex);
  }

  /** 
   * new array vertices
   */
  public AddArrayEdge(u: Area, v: ICellAddress): void {

    if (!u.start.sheet_id) {
      throw new Error('AddArrayEdge called without sheet ID');
    }

    // this should have already been added...
    const v_v = this.GetVertex(v, true);

    this.CompositeAddArrayEdge(u, v_v);

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

  /**
   * not used? remove
   * @deprecated
   */
  public SetAreaDirty(area: IArea): void {

    // console.info("SAD");

    if (area.start.column === Infinity
      || area.end.column === Infinity
      || area.start.row === Infinity
      || area.end.row === Infinity ){
        throw new Error('don\'t iterate over infinite area');
    }

    const sheet_id = area.start.sheet_id;
    if (!sheet_id) {
      throw new Error('invalid area, missing sheet id');
    }

    for (let column = area.start.column; column <= area.end.column; column++) {
      for (let row = area.start.row; row <= area.end.row; row++) {
        const address: ICellAddress = {row, column, sheet_id};
        const vertex = this.GetVertex(address, false);
        if (vertex) { this.SetDirty(address); }
        // this.SetArraysDirty(address);
      }
    }

  }

  public SetVertexDirty(vertex: SpreadsheetVertexBase): void {

    // console.info("SvD", vertex);

    // see below re: concern about relying on this

    if (vertex.dirty) { return; }

    this.dirty_list.push(vertex);
    vertex.dirty = true;

    for (const edge of vertex.edges_out) {
      this.SetVertexDirty(edge as SpreadsheetVertexBase);
    }

  }

  /** sets dirty */
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

      if (this.IsSpreadsheetVertex(vertex)) {
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

    /*
    if (this.GlobalLoopCheck()) {
      return GraphStatus.Loop;
    }
    */

    // FIXME: volatiles should proabbly be caclucated first,
    // not last, because they're probably primary.

    // for (const vertex of this.volatile_list) {
    //  vertex.SetDirty();
    // }

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

    /*
    this.spills = this.spills.filter(spill => {
      let dirty = false;
      for (const vertex of this.IterateVertices(spill)) {
        if (vertex.dirty) {
          console.info("spill is dirty (it)");
          dirty = true;
          break;
        }
      }

      if (dirty) {
        const cells = spill.start.sheet_id ? this.model.sheets.Find(spill.start.sheet_id)?.cells : undefined;
        if (cells) {
          for (const {cell, row, column} of cells.IterateRC(new Area(spill.start, spill.end))) {
            if (cell.spill) {
              cell.spill = undefined;
              if (typeof cell.value === 'undefined') {
                cell.Reset();
              }
              else {
                this.SetDirty({row, column, sheet_id: spill.start.sheet_id})
              }
            }
          }
        }
        return false; // drop
      }

      return true; // keep
    });
    */

    //////////////////////////////////////////

    this.calculation_list = this.dirty_list.slice(0);

    // console.info("CL", this.calculation_list);

    this.volatile_list = [];
    this.dirty_list = [];

    if (this.loop_check_required) {
      // console.info('reset loop state');

      this.ResetLoopState();
      this.loop_check_required = false;

    }


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
