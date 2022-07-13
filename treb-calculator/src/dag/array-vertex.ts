/**
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
 * with Foobar. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022 trebco, llc. + info@treb.app
 */

import type { Vertex } from './vertex';
import { GraphCallbacks, SpreadsheetVertexBase } from './spreadsheet_vertex_base';
import type { Area, ICellAddress2 } from 'treb-base-types';
import type { SpreadsheetVertex } from './spreadsheet_vertex';
import { Color } from './vertex';

/**
 * this is a new cut at array vertices. unlike the old version, we are not
 * trying to reduce the number of vertices (and in fact we won't). this is
 * to handle the case of unbounded arrays (full rows or columns). 
 * 
 * standard behavior with an array is to create all vertices when the reference
 * is created (this is wasteful, but works). this does _not_ work for unbounded
 * arrays because we may add rows/columns later which will expand arrays.
 * 
 * so this class is an intermediate vertex that sits between the dependent edge
 * and all the members of the array. if a new vertex is created later, we check
 * existing arrays to see if anyone will need to add it.
 * 
 * the more arrays you have, the more expensive these checks are (we could 
 * probably optimize this a bit), but it only happens at create time so 
 * potentially it's not too bad -- only on initial create and when manually
 * modifying the spreadsheet. 
 * 
 * [FIXME: that initial create step could definitely be optimized to limit checks]
 * 
 */
export class ArrayVertex extends SpreadsheetVertexBase {

  public static type = 'array-vertex';

  /**
   * this is the list of currently used array vertices. it will get cleaned
   * up when a vertex is no longer used (via the instance RemoveDependent 
   * overload) and when the graph is reset (via the static Clear method).
   * 
   * we could theoretically optimize this store, which might be useful if 
   * we start using a lot of these: split by sheet ID, sort in start/end order,
   * and so on. 
   */
  private static list: ArrayVertex[] = [];

  public type = ArrayVertex.type; // for type guard

  /** the target area */
  public area: Area;

  /* * temporary method, we should clean up explicitly * /
  public static CheckOutbound(): void {
    for (const vertex of this.list) {
      if (vertex.edges_out.length === 0) {
        console.info('no outbound edges', vertex);
      }
    }
  }
  */

  /** 
   * factory/lookup method: creates a vertex if it does not exist, or 
   * returns existing vertex. returns the vertex and a flag indicating
   * if this was created new (true) or not (false).
   */
  public static GetVertex(area: Area): [vertex: ArrayVertex, created: boolean] {
    for (const entry of this.list) {
      if ((entry.area.start.sheet_id === area.start.sheet_id) && entry.area.Equals(area)) {
        return [entry, false];
      }
    }
    return [new ArrayVertex(area), true];
  }

  /**
   * this seems sloppy, does this clean up properly?
   */
  public static Clear(): void {
    this.list = [];
  }

  /**
   * returns a list of arrays that contain this address
   */
  public static GetContainingArrays(address: ICellAddress2): ArrayVertex[] {
    // console.info('av2 get arrays:', address.row, address.column);
    const list: ArrayVertex[] = [];
    for (const entry of this.list) {
      if ((entry.area.start.sheet_id === address.sheet_id) && entry.area.Contains(address)) {
        // console.info("match", entry.area.spreadsheet_label);
        list.push(entry);
      }
    }
    return list;
  }

  /**
   * if any arrays contain this address, add edges
   */
  public static CreateImplicitEdges(vertex: Vertex, address: ICellAddress2): void {
    // console.info('av2 create implicit edges:', address.row, address.column);
    for (const entry of this.list) {
      if ((entry.area.start.sheet_id === address.sheet_id) && entry.area.Contains(address)) {
        // console.info("add to", entry.area.spreadsheet_label);
        entry.DependsOn(vertex);
      }
    }
  }

  /**
   * constructor adds the vertex to the internal list (static to this class).
   * 
   * UPDATE: use the factory method, which can check if a reference to this
   * area already exists. 
   */
  private constructor(range: Area) {
    super();
    this.area = range.Clone();
    ArrayVertex.list.push(this);
  }

  /**
   * override for RemoveDependent. if there are no more dependents, it will
   * be removed from our internal list (and hopefully GCd, but check). 
   */
  public RemoveDependent(edge: Vertex): void {
    super.RemoveDependent(edge);
    if (!this.edges_out.length) {
      // console.info('removing dead array vertex');
      this.Reset();
      ArrayVertex.list = ArrayVertex.list.filter(test => test !== this);
    }
  }  

  public Calculate(graph: GraphCallbacks): void {

    // this is copied from SpreadsheetVertex, just removing the 
    // actual calculation (because we have no output). 

    if (!this.dirty) {
      return;
    }
    
    if (this.color === Color.white && this.LoopCheck()) {

      // console.info('LC', this);
      this.dirty = false;

      if (this.edges_in.length) {

        // intuitively this seems like a good idea but I'm not sure
        // that it is actually necessary (TODO: check)

        for (const edge of this.edges_out){
          (edge as SpreadsheetVertex).Calculate(graph);
        }
      
        return;

      }
    }

    for (const edge of this.edges_in) {
      if ((edge as SpreadsheetVertexBase).dirty) {
        return;
      }
    }

    // console.info('setting dirty -> false');
    this.dirty = false;

    for (const edge of this.edges_out){
      (edge as SpreadsheetVertex).Calculate(graph);
    }

  }

}

// (self as any).AV2 = ArrayVertex2;
