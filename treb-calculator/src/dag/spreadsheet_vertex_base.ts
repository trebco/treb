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
 * Copyright 2022-2024 trebco, llc. 
 * info@treb.app
 * 
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
