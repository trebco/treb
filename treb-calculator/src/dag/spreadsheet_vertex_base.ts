
import { Vertex } from './vertex';
import type { UnionOrArray } from 'treb-base-types';

export interface CalculationResult {
  // value: any;
  value: UnionOrArray;
  volatile?: boolean;
}

/**
 * this is a subset of Graph so we can avoid the circular dependency.
 * not sure how to make this abstract in the instance, though... (TODO)
 */
export interface GraphImpl {
  CalculationCallback: (vertex: SpreadsheetVertexBase) => CalculationResult;
  SpreadCallback: (vertex: SpreadsheetVertexBase, value: UnionOrArray) => void;
  volatile_list: SpreadsheetVertexBase[];
}

export abstract class SpreadsheetVertexBase extends Vertex {
  public dirty = false;
  public abstract Calculate(graph: GraphImpl): void;
}
