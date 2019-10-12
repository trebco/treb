
import { Vertex } from './vertex';
import { SpreadsheetVertex, CalculationResult } from './spreadsheet_vertex';
import { ArrayVertex } from './array_vertex';
import { SpreadsheetVertexBase } from './spreadsheet_vertex_base';
import { LeafVertex } from './leaf_vertex';
import { Cells, ICellAddress, Area, IArea } from 'treb-base-types';
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
    // this.cells = model.active_sheet.cells;

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

  /** returns the vertex at this address. creates it if necessary. */
  public GetVertex(address: ICellAddress, create: boolean) {

    if (!address.sheet_id) { throw new Error('getvertex with no sheet id'); }

    // if (!this.cells) return undefined;

    const cells = this.cells_map[address.sheet_id];

    if (!cells) {
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

    // vertex.reference = this.cells.data2[address.row][address.column];
    // vertex.reference = this.cells.EnsureCell(address);

    // works ok, maybe a little verbose

    const row = cells.data2[address.row];
    if (row) {
      const cell = row[address.column];
      if (cell) {
        vertex.reference = cell;
      }
    }

    this.vertices[address.sheet_id][address.column][address.row] = vertex;

    // if there's an array that contains this cell, we need to create an edge

    this.CreateImplicitEdgeToArrays(vertex);

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
      if (set_dirty) {
        this.SetArraysDirty(address);
      }
      return;
    }

    vertex.ClearDependencies();

    if (set_dirty) {
      this.dirty_list.push(vertex);
      vertex.SetDirty();
    }
  }

  /** adds an edge from u -> v */
  public AddEdge(u: ICellAddress, v: ICellAddress): GraphStatus {

    const v_u = this.GetVertex(u, true);
    const v_v = this.GetVertex(v, true);

    if (!v_v || !v_u) return GraphStatus.OK; // not possible to loop -> null

    // loop check
    // FIXME: move to vertex class

    // let tcc = 0;

    const check_list: Vertex[] = [];

    const tail = (vertex: Vertex, depth = ''): boolean => {

      if (vertex === v_u) {
        console.info('MATCH', vertex, v_v, v_u);
        return true;
      }

      // switch to non-functional loop
      for (const check of check_list) if (check === vertex) return false; // already checked this branch

      check_list.push(vertex);

      return vertex.edges_out.some((edge) => tail(edge, depth + '  '));
    };

    // throw or return value? [A: return value]

    if (tail(v_v)) return GraphStatus.Loop; // throw( "not adding, loop");

    v_u.AddDependent(v_v);
    v_v.AddDependency(v_u);

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

  /** sets area dirty, convenience shortcut */
  public SetAreaDirty(area: Area) {
    area.Iterate((address: ICellAddress) => {
      const vertex = this.GetVertex(address, false);
      if (vertex) this.SetDirty(address);
    });
  }

  /** sets dirty */
  public SetDirty(address: ICellAddress) {

    const vertex = this.GetVertex(address, true);
    if (!vertex) return;

    // is it safe to assume that, if the dirty flag is set, it's
    // on the dirty list? I'm not sure that's the case if there's
    // an error.

    this.dirty_list.push(vertex);
    vertex.SetDirty();
  }

  // --- array vertices... testing ---

  public CreateImplicitEdgeToArray(array_vertex: ArrayVertex) {

    if (!array_vertex.area.start.sheet_id) {
      console.info("area missing sheet id");
      return;
    }

    array_vertex.area.Iterate((address) => {
      const vertex = this.GetVertex(address, false);
      if (vertex) {
        console.info('CreateImplicitEdgeToArray', vertex.address, array_vertex.area);
        array_vertex.AddDependency(vertex);
        vertex.AddDependent(array_vertex);
      }
    });

  }

  public CreateImplicitEdgeToArrays(vertex: SpreadsheetVertex) {

    if (!vertex.address) {
      console.info("vertex missing address");
      return;
    }
    if (!vertex.address.sheet_id) {
      console.info("vertex missing sheet id");
      return;
    }

    for (const key of Object.keys(this.array_vertices)) {
      const array_vertex = this.array_vertices[key];
      if (array_vertex.area.start.sheet_id === vertex.address.sheet_id &&
          array_vertex.area.Contains(vertex.address)) {

        console.info('CreateImplicitEdgeToArray', vertex.address, array_vertex.area);

        array_vertex.AddDependency(vertex);
        vertex.AddDependent(array_vertex);

      }
    }
  }

  public SetArraysDirty(address: ICellAddress) {

    for (const key of Object.keys(this.array_vertices)) {
      const array_vertex = this.array_vertices[key];
      if (array_vertex.area.start.sheet_id === address.sheet_id &&
          array_vertex.area.Contains(address)) {
        this.dirty_list.push(array_vertex);
        array_vertex.SetDirty();
      }
    }

  }

  /*
  public SetArraysDirty(address: ICellAddress) {

    console.info("SetArraysDirty", address);

    for (const vertex of Object.values(this.array_vertices)) {
      if (vertex.area.Contains(address)) {
        for (const edge of vertex.edges_out as SpreadsheetVertex[]) {
          if (!edge.SetDirty()) {
            this.dirty_list.push(edge);
            if (edge.address) { this.SetArraysDirty(edge.address); }
          }
        }
      }
    }
  }

  public ResetInboundArrays(address: ICellAddress, set_dirty = false){
    for (const vertex of Object.values(this.array_vertices)) {
      if (vertex.area.Contains(address)) {
        vertex.ClearDependencies();
        if (set_dirty) {
          for (const edge of vertex.edges_out as SpreadsheetVertex[]) {
            if (!edge.SetDirty()) {
              this.dirty_list.push(edge);
              if (edge.address) {
                this.SetArraysDirty(edge.address);
              }
            }
          }
        }
      }
    }

  }
  */

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

    // FIXME: loop check

    // ...

    if (!v_u || !v_v) { return GraphStatus.Loop; }

    console.info("add ave", u, v);

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

    if (!v_u) return GraphStatus.OK; // not possible to loop -> null

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

  public InitializeGraphValues() {

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

    for (const vertex of this.volatile_list) {
      vertex.SetDirty();
    }

    const calculation_list = this.volatile_list.slice(0).concat(this.dirty_list);

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
