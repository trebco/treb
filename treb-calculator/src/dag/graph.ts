
import { Vertex, Color } from './vertex';
import { SpreadsheetVertex  } from './spreadsheet_vertex';
import { ArrayVertex  } from './array-vertex';
import { SpreadsheetVertexBase, CalculationResult, GraphCallbacks } from './spreadsheet_vertex_base';
import { LeafVertex } from './leaf_vertex';
import { Cells, ICellAddress, ICellAddress2, Area, IArea, UnionOrArray } from 'treb-base-types';
import { DataModel } from 'treb-grid';

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

  public cells_map: {[index: number]: Cells} = {};

  public model?: DataModel;

  /**
   * where is the loop in the graph (or at least the first one we found)?
   */
  public loop_hint?: string;

  // special
  public leaf_vertices: LeafVertex[] = [];

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

  /**
   * attach data. normally this is done as part of a calculation, but we can
   * do it without a calculation to support annotations that use leaf vertices
   */
  protected AttachData(model: DataModel): void {
    this.model = model;
    this.cells_map = {};
    for (const sheet of model.sheets) {
      this.cells_map[sheet.id] = sheet.cells;
    }
  }

  /**
   * flush the graph, calculation tree and cells reference
   */
  public FlushTree(): void {
    this.dirty_list = [];
    this.volatile_list = [];
    this.vertices = [[]];
    this.leaf_vertices = [];
    this.cells_map = {};

    /** array vertex maintains its own list */
    ArrayVertex.Clear();

  }

  public ResolveArrayHead(address: ICellAddress): ICellAddress {

    if (!address.sheet_id) { throw new Error('resolve array head with no sheet id'); }
    const cells = this.cells_map[address.sheet_id];

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

  /** overload */
  public GetVertex(address: ICellAddress, create: true): SpreadsheetVertex;

  /** overload */
  public GetVertex(address: ICellAddress, create?: boolean): SpreadsheetVertex | undefined;

  /** returns the vertex at this address. creates it if necessary. */
  public GetVertex(address: ICellAddress, create?: boolean): SpreadsheetVertex | undefined {

    if (!address.sheet_id) { throw new Error('getvertex with no sheet id'); }

    // if (!this.cells) return undefined;

    const cells = this.cells_map[address.sheet_id];

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


  /**
   * resets the vertex by removing inbound edges and clearing formula flag.
   * we have an option to set dirty because they get called together
   * frequently, saves a lookup.
   */
  public ResetInbound(address: ICellAddress, set_dirty = false, create = true, remove = false): void {

    // console.info("RIB", address.row, address.column, 'd?', set_dirty);

    const vertex = this.GetVertex(address, create);

    if (!vertex) {
      if (set_dirty) {
        const list = ArrayVertex.GetContainingArrays(address as ICellAddress2);
        for (const entry of list) {
          this.SetVertexDirty(entry);
        }
      }
      return;
    }

    vertex.ClearDependencies();

    if (set_dirty) {
      // this.dirty_list.push(vertex);
      // vertex.SetDirty();
      this.SetVertexDirty(vertex);
    }

    // vertex.expression = { type: 'missing', id: -1 };
    // vertex.expression_error = false;
    
    if (remove) {
      this.RemoveVertex(address);
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
                vertex.color = vertex.edges_out.length ? Color.white : Color.black;
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
                vertex.color = vertex.edges_out.length ? Color.white : Color.black;
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

                edge.color = Color.gray;
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
    if (address.sheet_id && this.model) {
      for (const sheet of this.model.sheets) {
        if (address.sheet_id === sheet.id) {
          sheet_name = sheet.name + '!';
          break;
        }
      }
    }

    const area = new Area(address);
    return sheet_name + area.spreadsheet_label;
    
  }

  /** 
   * new array vertices
   */
  public AddArrayEdge(u: Area, v: ICellAddress): void {

    // console.info('add array edge', u, v);

    if (!u.start.sheet_id) {
      throw new Error('AddArrayEdge called without sheet ID');
    }

    // this should have already been added...
    const v_v = this.GetVertex(v, true);

    // create or use existing
    const [array_vertex, created] = ArrayVertex.GetVertex(u);

    // add an edge
    v_v.DependsOn(array_vertex);

    // force a check on next calculation pass
    this.loop_check_required = true;

    if (!created) {
      // console.info('reusing, so not adding edges');
      return;
    }

    // now add edges from/to nodes THAT ALREADY EXIST

    // range can't span sheets, so we only need one set to look up

    const map = this.vertices[u.start.sheet_id];

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
      console.groupEnd();
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
      console.groupEnd();
    }
    else {
      for (let row = u.start.row; row <= u.end.row; row++) {
        for (let column = u.start.column; column <= u.end.column; column++) {
          const vertex = map[column][row];
          if (vertex) {
            array_vertex.DependsOn(vertex);
          }
        }
      }
    }

  }

  /** adds an edge from u -> v */
  public AddEdge(u: ICellAddress, v: ICellAddress): void {

    const v_u = this.GetVertex(u, true);
    const v_v = this.GetVertex(v, true);

    // seems pretty uncommon, not sure it's a useful optimization
    // const already_connected = v_u.edges_out.includes(v_v);
    // if (already_connected) 
    //  console.info('add edge', u.sheet_id, u.row, u.column, '->', v.sheet_id, v.row, v.column, already_connected ? '***' : '')

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
      }, v);
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

    const vertex = this.GetVertex(address, true);
    this.SetVertexDirty(vertex);

  }

  // --- leaf vertex api ---

  /**
   * adds a leaf vertex to the graph. this implies that someone else is
   * managing and maintaining these vertices: we only need references.
   */
  public AddLeafVertex(vertex: LeafVertex): void {

    // ... don't add more than once. this is expensive but
    // the list should (generally speaking) be short, so not
    // a serious problem atm

    /*
    if (this.leaf_vertices.some((test) => test === vertex)) {
      return;
    }
    */
   for (const test of this.leaf_vertices) {
     if (test === vertex) {
       return;
     }
   }

    this.leaf_vertices.push(vertex);
  }

  /** removes vertex, by match */
  public RemoveLeafVertex(vertex: LeafVertex): void {
    this.leaf_vertices = this.leaf_vertices.filter((test) => test !== vertex);
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

    // const calculation_list = this.volatile_list.slice(0).concat(this.dirty_list);

    // we do this using the local function so we can trace back arrays

    for (const vertex of this.volatile_list) {
      this.SetVertexDirty(vertex as SpreadsheetVertex);
    }
    // const calculation_list = this.dirty_list.slice(0);
    this.calculation_list = this.dirty_list.slice(0);

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

  public abstract SpreadCallback(vertex: SpreadsheetVertexBase, value: UnionOrArray): void;

  protected abstract CheckVolatile(vertex: SpreadsheetVertex): boolean;

}
