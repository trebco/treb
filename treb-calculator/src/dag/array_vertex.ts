
import { Vertex } from './vertex';
import { Cell, ICellAddress, Area } from 'treb-base-types';

type Graph = import('./graph').Graph; // circular; type only

/**
 * specialization of vertex
 */
export class ArrayVertex extends Vertex {

  public type = 'array-vertex'; // for type guard

  public area = new Area({row: 0, column: 0});

}
