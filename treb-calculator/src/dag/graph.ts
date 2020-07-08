
import { Vertex } from './vertex';
import { SpreadsheetVertex, CalculationResult } from './spreadsheet_vertex';
import { ArrayVertex } from './array_vertex';
import { SpreadsheetVertexBase } from './spreadsheet_vertex_base';
import { LeafVertex } from './leaf_vertex';
import { Cells, ICellAddress, Area, IArea, Cell } from 'treb-base-types';
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
export abstract class Graph {

  // public vertices: Array<Array<SpreadsheetVertex|undefined>> = [];
  public vertices: Array<Array<Array<SpreadsheetVertex|undefined>>> = [[]];

  public volatile_list: SpreadsheetVertexBase[] = [];
  public cells_map: {[index: number]: Cells} = {};
  public model?: DataModel;

  // special
  public leaf_vertices: LeafVertex[] = [];

  // special
  public array_vertices: {[index: string]: ArrayVertex} = {};

  /** lock down access */
  private dirty_list: SpreadsheetVertexBase[] = [];

  public IsArrayVertex(vertex: Vertex): vertex is ArrayVertex {
    return vertex.type === 'array-vertex';
  }

  public IsSpreadsheetVertex(vertex: Vertex): vertex is SpreadsheetVertex {
    return vertex.type === 'spreadsheet-vertex';
  }

  /**
   * attach data. normally this is done as part of a calculation, but we can
   * do it without a calculation to support annotations that use leaf vertices
   */
  public AttachData(model: DataModel){
    this.model = model;
    this.cells_map = {};
    for (const sheet of model.sheets) {
      this.cells_map[sheet.id] = sheet.cells;
    }
  }

  /**
   * flush the graph, calculation tree and cells reference
   */
  public FlushTree() {
    this.dirty_list = [];
    this.volatile_list = [];
    this.vertices = [[]];
    this.leaf_vertices = [];
    this.array_vertices = {};
    // this.cells = undefined;
    this.cells_map = {};
  }

  public ResolveArrayHead(address: ICellAddress): ICellAddress {

    if (!address.sheet_id) { throw new Error('resolve array head with no sheet id'); }
    const cells = this.cells_map[address.sheet_id];

    if (!cells) {
      throw new Error('no cells? sheet id ' + address.sheet_id);
    }

    const row = cells.data2[address.row];
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
  public GetVertex(address: ICellAddress, create?: boolean) {

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
    vertex.address = { ...address };

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

    return vertex;

  }

  /** deletes the vertex at this address. */
  public RemoveVertex(address: ICellAddress) {

    if (!address.sheet_id) { throw new Error('removevertex with no sheet id'); }

    const vertex = this.GetVertex(address, false);
    if (!vertex) return;
    vertex.Reset();
    this.vertices[address.sheet_id][address.column][address.row] = undefined;

  }

  /** removes all edges, for rebuilding. leaves value/formula as-is. */
  public ResetVertex(address: ICellAddress) {
    const vertex = this.GetVertex(address, false);
    if (vertex) vertex.Reset();
  }

  /**
   * resets the vertex by removing inbound edges and clearing formula flag.
   * we have an option to set dirty because they get called together
   * frequently, saves a lookup.
   */
  public ResetInbound(address: ICellAddress, set_dirty = false, create = true){

    const vertex = this.GetVertex(address, create);

    if (!vertex) {
      /*
      if (set_dirty) {
        this.SetArraysDirty(address);
      }
      */
      return;
    }

    vertex.ClearDependencies();

    if (set_dirty) {
      // this.dirty_list.push(vertex);
      // vertex.SetDirty();
      this.SetVertexDirty(vertex);
    }

  }

  public LoopCheck(v: Vertex, u: Vertex) {

    const check_list: Vertex[] = [];

    const tail = (vertex: Vertex, depth = ''): boolean => {

      if (vertex === u) {
        console.info('MATCH', vertex, v, u);
        return true;
      }

      // switch to non-functional loop
      for (const check of check_list) {
        if (check === vertex) return false; // already checked this branch
      }

      check_list.push(vertex);

      return vertex.edges_out.some((edge) => tail(edge, depth + '  '));
    };

    // throw or return value? [A: return value]

    if (tail(v)) {
      return GraphStatus.Loop; // throw( "not adding, loop");
    }

    return GraphStatus.OK;

  }

  /** adds an edge from u -> v */
  public AddEdge(u: ICellAddress, v: ICellAddress): GraphStatus {

    const v_u = this.GetVertex(u, true);
    const v_v = this.GetVertex(v, true);

    const status = this.LoopCheck(v_v, v_u);

    if (status === GraphStatus.Loop) { return status; }

    v_u.AddDependent(v_v);
    v_v.AddDependency(v_u);

    // add implicit edge to array head. this is required at start
    // because the array isn't set implicitly (why not?)

    // watch out for missing sheet ID!

    if (v_u.reference && v_u.reference.area && !v_u.array_head) {
      this.AddEdge({
        ...u,
        row: v_u.reference.area.start.row,
        column: v_u.reference.area.start.column,
      }, u);
    }

    return GraphStatus.OK;
  }

  /** removes edge from u -> v */
  public RemoveEdge(u: ICellAddress, v: ICellAddress) {

    const v_u = this.GetVertex(u, false);
    const v_v = this.GetVertex(v, false);

    if (!v_u || !v_v) return;

    v_u.RemoveDependent(v_v);
    v_v.RemoveDependency(v_u);

  }

  public SetAreaDirty(area: IArea) {

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
        this.SetArraysDirty(address);
      }
    }

  }

  /* * sets area dirty, convenience shortcut * /
  public SetAreaDirtyX(area: Area) {
    area.Iterate((address: ICellAddress) => {
      const vertex = this.GetVertex(address, false);
      if (vertex) this.SetDirty(address);
    });
  }
  */

  public SetVertexDirty(vertex: SpreadsheetVertex) {

    // see below re: concern about relying on this

    if (vertex.dirty) { return; }

    this.dirty_list.push(vertex);
    vertex.dirty = true;

    for (const edge of vertex.edges_out) {
      this.SetVertexDirty(edge as SpreadsheetVertex);
    }

    /*

    // is it safe to assume that, if the dirty flag is set, it's
    // on the dirty list? I'm not sure that's the case if there's
    // an error.

    this.dirty_list.push(vertex);
    vertex.SetDirty();

    // so for arrays, make sure every member of the array is
    // dirty (if there's a vertex). only call this from the 
    // array head (and don't call the array head).

    if (vertex.reference && vertex.reference.area && vertex.array_head) {
      const {start, end} = vertex.reference.area;
      const sheet_id = start.sheet_id || vertex.address?.sheet_id;
      for (let column = start.column; column <= end.column; column++) {
        for (let row = start.row; row <= end.row; row++) {
          if (column === start.column && row === start.row) { continue; } // same same

          const member = this.GetVertex({row, column, sheet_id}, false);
          if (member && !member.dirty) { this.SetVertexDirty(member); }

        }
      }
    }

    */

  }

  /** sets dirty */
  public SetDirty(address: ICellAddress) {

    const vertex = this.GetVertex(address, true);
    this.SetVertexDirty(vertex);

  }

  // --- array vertices... testing ---

  public CreateImplicitEdgeToArray(array_vertex: ArrayVertex) {

    if (!array_vertex.area.start.sheet_id) {
      console.info('area missing sheet id');
      return;
    }

    array_vertex.area.Iterate((address) => {
      const vertex = this.GetVertex(address, false);
      // const vertex = this.GetVertex(this.ResolveArrayHead(address), false);
      if (vertex) {
        // console.info('CreateImplicitEdgeToArray', vertex.address, array_vertex.area);
        array_vertex.AddDependency(vertex);
        vertex.AddDependent(array_vertex);
      }
      else {
        console.info('no vertex in CIE', address);
      }
    });

  }

  public CreateImplicitEdgeToArrays(vertex: SpreadsheetVertex) {

    if (!vertex.address) {
      console.info('vertex missing address');
      return;
    }
    if (!vertex.address.sheet_id) {
      console.info('vertex missing sheet id');
      return;
    }

    for (const key of Object.keys(this.array_vertices)) {
      const array_vertex = this.array_vertices[key];
      if (array_vertex.area.start.sheet_id === vertex.address.sheet_id &&
          array_vertex.area.Contains(vertex.address)) {

        // console.info('CreateImplicitEdgeToArray', vertex.address, array_vertex.area);
        array_vertex.AddDependency(vertex);
        vertex.AddDependent(array_vertex);
      }
    }
  }

  public SetArraysDirty(address: ICellAddress) {

    throw new Error('set arrays dirty');

    /*
    // console.info("SAD", address)

    for (const key of Object.keys(this.array_vertices)) {
      const array_vertex = this.array_vertices[key];
      if (array_vertex.area.start.sheet_id === address.sheet_id &&
          array_vertex.area.Contains(address)) {
        this.dirty_list.push(array_vertex);
        array_vertex.SetDirty();
      }
    }
    */

  }

  public GetArrayVertex(area: Area, create: true): ArrayVertex;

  public GetArrayVertex(area: Area, create?: boolean): ArrayVertex|undefined;

  public GetArrayVertex(area: Area, create: boolean): ArrayVertex|undefined {
    const label = area.start.sheet_id + '!' + area.spreadsheet_label;
    let vertex = this.array_vertices[label];
    if (!vertex && create) {
      vertex = new ArrayVertex();
      vertex.area = area.Clone();
      this.array_vertices[label] = vertex;
      this.CreateImplicitEdgeToArray(vertex);
    }
    return vertex;
  }

  public AddArrayVertex(area: Area) {
    return this.GetArrayVertex(area, true);
  }

  public RemoveArrayVertex(area: Area) {

    // FIXME: set undefined, and wait for another cleanup? or delete?

    const label = area.spreadsheet_label;
    const vertex = this.array_vertices[label];
    if (!vertex) { return; }
    vertex.Reset();
    delete this.array_vertices[area.spreadsheet_label];

  }

  /** add edge from u -> v */
  public AddArrayVertexEdge(u: Area, v: ICellAddress): GraphStatus {

    if (u.start.sheet_id === v.sheet_id && u.Contains(v)) {
      return GraphStatus.Loop;
    }

    const v_u = this.GetArrayVertex(u, true); // create if necessary
    const v_v = this.GetVertex(v, true);

    const status = this.LoopCheck(v_v, v_u);

    if (status === GraphStatus.Loop) { return status; }

    v_u.AddDependent(v_v);
    v_v.AddDependency(v_u);

    return GraphStatus.OK;

  }

  /** remove edge from u -> v */
  public RemoveArrayVertexEdge(u: Area, v: ICellAddress) {

    const v_u = this.GetArrayVertex(u, false);
    const v_v = this.GetVertex(v, false);

    if (!v_u || !v_v) { return; }

    v_u.RemoveDependent(v_v);
    v_v.RemoveDependency(v_u);

  }

  // --- leaf vertex api ---

  /**
   * adds a leaf vertex to the graph. this implies that someone else is
   * managing and maintaining these vertices: we only need references.
   */
  public AddLeafVertex(vertex: LeafVertex){

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
  public RemoveLeafVertex(vertex: LeafVertex){
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
  public AddLeafVertexEdge(u: ICellAddress, v: LeafVertex) {

    const v_u = this.GetVertex(u, true);

    v_u.AddDependent(v);
    v.AddDependency(v_u);

    return GraphStatus.OK;

  }

  /** removes edge from u -> v */
  public RemoveLeafVertexEdge(u: ICellAddress, v: LeafVertex) {
    const v_u = this.GetVertex(u, false);

    if (!v_u) return;

    v_u.RemoveDependent(v);
    v.RemoveDependency(v_u);

  }

  // --- for initial load ---

  public InitializeGraph() {

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
  public Recalculate() {

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
    const calculation_list = this.dirty_list.slice(0);

    this.volatile_list = [];
    this.dirty_list = [];

    // recalculate everything that's dirty. FIXME: optimize path
    // so we do fewer wasted checks of "are all my deps clean"?

    for (const vertex of calculation_list) {
      vertex.Calculate(this);
    }

  }

  public abstract CalculationCallback(vertex: SpreadsheetVertex): CalculationResult;
  public abstract SpreadCallback(vertex: SpreadsheetVertex, value: any): void;

  protected abstract CheckVolatile(vertex: SpreadsheetVertex): boolean;

}
