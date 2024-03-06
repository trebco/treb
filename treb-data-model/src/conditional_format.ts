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

import type { CellStyle, EvaluateOptions, IArea, Color, Gradient, GradientStop, UnionValue } from 'treb-base-types';

interface VertexPlaceholder {
  result: UnionValue;
  updated: boolean;
} 

export interface CondifionalFormatExpressionOptions {
  style: CellStyle;
  expression: string;
  options?: EvaluateOptions;
}

/** 
 * conditional format predicated on an expression. if the expression 
 * evaluates to true, we apply the style. otherwise no.
 */
export interface ConditionalFormatExpression extends CondifionalFormatExpressionOptions {
  
  type: 'expression';
  area: IArea;

  /** @internal */
  internal?: {
    vertex?: VertexPlaceholder;
  };

}

export interface ConditionalFormatGradientOptions {

  /** property defaults to fill */
  property?: 'fill'|'text';

  /** defaults to RGB */
  color_space?: 'HSL'|'RGB';

  /** gradient stops, required */
  stops: Array<{ value: number, color: Color }>;
  
  /** min and max are optional. if not provided, we use the min/max of the range of data. */
  min?: number;
  
  /** min and max are optional. if not provided, we use the min/max of the range of data. */
  max?: number;

}

/**
 * @internal
 * 
 * @privateRemarks
 * 
 * this is marked internal temporarily while I figure out why our API
 * generator is not exporting the gradient stop type
 */
export const StandardGradientsList = {
  'red-green': {
    color_space: 'RGB',
    stops: [
      { value: 0, color: { theme: 5, tint: .5 }}, 
      { value: 1, color: { theme: 9, tint: .5 }}, 
    ] as GradientStop[],
  },
  'red-yellow-green': {
    color_space: 'RGB',
    stops: [
      { value: 0, color: { theme: 5, tint: .5 }}, 
      { value: 0.5, color: { theme: 7, tint: .5 }}, 
      { value: 1, color: { theme: 9, tint: .5 }}, 
    ] as GradientStop[],
  },
  'green-red': {
    color_space: 'RGB',
    stops: [
      { value: 0, color: { theme: 9, tint: .5 }}, 
      { value: 1, color: { theme: 5, tint: .5 }}, 
    ] as GradientStop[],
  },
  'green-yellow-red': {
    color_space: 'RGB',
    stops: [
      { value: 0, color: { theme: 9, tint: .5 }}, 
      { value: 0.5, color: { theme: 7, tint: .5 }}, 
      { value: 1, color: { theme: 5, tint: .5 }}, 
    ] as GradientStop[],
  },
} as const; 
export type StandardGradient = keyof typeof StandardGradientsList;

export interface ConditionalFormatGradient extends ConditionalFormatGradientOptions {
  type: 'gradient';
  area: IArea;

  /** @internal */
  internal?: {
    gradient?: Gradient;
    vertex?: VertexPlaceholder;
  };
}

export interface ConditionalFormatCellMatchOptions {
  style: CellStyle;
  expression: string;
  options?: EvaluateOptions;
}

export interface ConditionalFormatCellMatch extends ConditionalFormatCellMatchOptions {
  type: 'cell-match';
  area: IArea;

  /** @internal */
  internal?: {
    vertex?: VertexPlaceholder;
  };
}

export interface ConditionalFormatCellMatchOptions {
  style: CellStyle;
  expression: string;
  options?: EvaluateOptions;
}

export interface ConditionalFormatCellMatch extends ConditionalFormatCellMatchOptions {
  type: 'cell-match';
  area: IArea;

  /** @internal */
  internal?: {
    vertex?: VertexPlaceholder;
  };
}

export interface ConditionalFormatDuplicateValuesOptions {
  style: CellStyle;

  /** true to highlight unique cells, false to highlight duplicates. defaults to false. */
  unique?: boolean;
}

export interface ConditionalFormatDuplicateValues extends ConditionalFormatDuplicateValuesOptions {

  type: 'duplicate-values';
  area: IArea;

  /** @internal */
  internal?: {
    vertex?: VertexPlaceholder;
  };

}

/** 
 * union, plus we're adding a state used to track application.
 * that state is serialized if it's true. 
 * we also add an internal field that will be type-specific, and not serialized.
 * 
 * ...everybody has a vertex now, we could standardize it
 * 
 */
export type ConditionalFormat = { internal?: unknown } & (
    ConditionalFormatDuplicateValues |
    ConditionalFormatExpression |
    ConditionalFormatCellMatch |
    ConditionalFormatGradient
  );

/**
 * the list of formats, in reverse order of precedence. as a starting
 * point we're using the naive approach, just applying everything in
 * order. that may change.
 */
export type ConditionalFormatList = ConditionalFormat[];

