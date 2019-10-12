
import { Vertex } from './vertex';
import { SpreadsheetVertexBase } from './spreadsheet_vertex_base';
import { Cell, ICellAddress, Area } from 'treb-base-types';
import { SpreadsheetVertex } from './spreadsheet_vertex';

type Graph = import('./graph').Graph; // circular; type only

/**
 * specialization of vertex
 */
export class ArrayVertex extends SpreadsheetVertexBase {

  public type = 'array-vertex'; // for type guard

  public area = new Area({row: 0, column: 0});

  public Calculate(graph: any): void {

    if (!this.dirty) return;

    for (const edge of this.edges_in) {
      if ((edge as SpreadsheetVertexBase).dirty) {
        return;
      }
    }

    this.dirty = false;

    for (const edge of this.edges_out){
      (edge as SpreadsheetVertex).Calculate(graph);
    }

  }

}
