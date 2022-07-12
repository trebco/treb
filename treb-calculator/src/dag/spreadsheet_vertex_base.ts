/**
 * This file is part of TREB.
 * Copyright 2022 trebco, llc.
 * info@treb.app
 */

import { Vertex } from './vertex';
import type { UnionValue } from 'treb-base-types';

export interface CalculationResult {
  // value: any;
  value: UnionValue;
  volatile?: boolean;
}

/**
 * this is a subset of Graph so we can avoid the circular dependency.
 */
export interface GraphCallbacks {
  CalculationCallback: (vertex: SpreadsheetVertexBase) => CalculationResult;
  SpreadCallback: (vertex: SpreadsheetVertexBase, value: UnionValue) => void;
  volatile_list: SpreadsheetVertexBase[];
  calculation_list: SpreadsheetVertexBase[];
}

export abstract class SpreadsheetVertexBase extends Vertex {
  public dirty = false;
  public abstract Calculate(graph: GraphCallbacks): void;
}
