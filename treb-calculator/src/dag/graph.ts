
import { Vertex } from './vertex';
import { SpreadsheetVertex, CalculationResult } from './spreadsheet_vertex';
import { LeafVertex } from './leaf_vertex';
import { Cells, ICellAddress, Area } from 'treb-base-types';
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

  public vertices: Array<Array<SpreadsheetVertex|null>> = [];
  public dirty_list: SpreadsheetVertex[] = [];
  public volatile_list: SpreadsheetVertex[] = [];
  public cells?: Cells;
  public model?: DataModel;

  // special
  public leaf_vertices: LeafVertex[] = [];

  /**
   * attach data. normally this is done as part of a calculation, but we can
   * do it without a calculation to support annotations that use leaf vertices
   *
   * @param cells
   */
  public AttachData(model: DataModel){
    this.model = model;
    this.cells = model.sheet.cells;
  }

  /**
   * flush the graph, calculation tree and cells reference
   */
  public FlushTree() {
    this.dirty_list = [];
    this.volatile_list = [];
    this.vertices = [];
    this.leaf_vertices = [];
    this.cells = undefined;
  }

  // public DumpEdges() {}

  /** returns the vertex at this address. creates it if necessary. */
  public GetVertex(address: ICellAddress) {
    if (!this.cells) return null;

    if (!this.vertices[address.column]) this.vertices[address.column] = [];
    let vertex = this.vertices[address.column][address.row];
    if (vertex) return vertex;
    vertex = new SpreadsheetVertex();
    vertex.address = {column: address.column, row: address.row};

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

    const row = this.cells.data2[address.row];
    if (row) {
      const cell = row[address.column];
      if (cell) vertex.reference = cell;
    }

    this.vertices[address.column][address.row] = vertex;
    return vertex;
  }

  /** returns the vertex at this address, but doesn't create it. */
  public GetVertexOrUndefined(address: ICellAddress) {
    if (!this.vertices[address.column]) return undefined;
    return this.vertices[address.column][address.row];
  }

  /** deletes the vertex at this address. */
  public RemoveVertex(address: ICellAddress) {
    const vertex = this.GetVertexOrUndefined(address);
    if (!vertex) return;
    vertex.Reset();
    this.vertices[address.column][address.row] = null;
  }

  /** removes all edges, for rebuilding. leaves value/formula as-is. */
  public ResetVertex(address: ICellAddress) {
    const vertex = this.GetVertexOrUndefined(address);
    if (vertex) vertex.Reset();
  }

  /**
   * resets the vertex by removing inbound edges and clearing formula flag.
   * we have an option to set dirty because they get called together
   * frequently, saves a lookup.
   */
  public ResetInbound(address: ICellAddress, set_dirty = false){
    const vertex = this.GetVertex(address);
    if (null === vertex) return;
    vertex.ClearDependencies();
    if (set_dirty) {
      this.dirty_list.push(vertex);
      vertex.SetDirty();
    }
  }

  /** adds an edge from u -> v */
  public AddEdge(u: ICellAddress, v: ICellAddress): GraphStatus {

    const v_u = this.GetVertex(u);
    const v_v = this.GetVertex(v);

    if (null === v_v || null === v_u) return GraphStatus.OK; // not possible to loop -> null

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
    const v_u = this.GetVertexOrUndefined(u);
    const v_v = this.GetVertexOrUndefined(v);

    if (!v_u || !v_v) return;

    v_u.RemoveDependent(v_v);
    v_v.RemoveDependency(v_u);

  }

  /** sets area dirty, convenience shortcut */
  public SetAreaDirty(area: Area) {
    area.Iterate((address: ICellAddress) => {
      const vertex = this.GetVertexOrUndefined(address);
      if (vertex) this.SetDirty(address);
    });
  }

  /** sets dirty */
  public SetDirty(address: ICellAddress) {
    const vertex = this.GetVertex(address);
    if (null === vertex) return;

    // is it safe to assume that, if the dirty flag is set, it's
    // on the dirty list? I'm not sure that's the case if there's
    // an error.

    this.dirty_list.push(vertex);
    vertex.SetDirty();
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

    if (this.leaf_vertices.some((test) => test === vertex)) {
      return;
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

    const v_u = this.GetVertex(u);

    if (null === v_u) return GraphStatus.OK; // not possible to loop -> null

    v_u.AddDependent(v);
    v.AddDependency(v_u);

    return GraphStatus.OK;

  }

  /** removes edge from u -> v */
  public RemoveLeafVertexEdge(u: ICellAddress, v: LeafVertex) {
    const v_u = this.GetVertexOrUndefined(u);

    if (!v_u) return;

    v_u.RemoveDependent(v);
    v.RemoveDependency(v_u);

  }

  // --- calculation ---

  /** runs calculation */
  public Recalculate() {

    // FIXME: volatiles should proabbly be caclucated first,
    // not last, because they're probably primary.

    for (const vertex of this.volatile_list) {

      // FIXME: use method, add parameter?
      // this.dirty_list.push(vertex);

      vertex.SetDirty();
    }

    const tmp = this.volatile_list.slice(0).concat(this.dirty_list);

    this.volatile_list = [];
    this.dirty_list = [];

    // recalculate everything that's dirty. FIXME: optimize path
    // so we do fewer wasted checks of "are all my deps clean"?

    for (const vertex of tmp) {
      vertex.Calculate(this, this.CalculationCallback, this.SpreadCallback);
    }

  }

  protected abstract CalculationCallback(vertex: SpreadsheetVertex): CalculationResult;
  protected abstract SpreadCallback(vertex: SpreadsheetVertex, value: any): void;

}
