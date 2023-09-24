
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

  /** defaults to HSL */
  color_space?: 'HSL'|'RGB';

  /** gradient stops, required */
  stops: Array<{ value: number, color: Color }>;
  
  /** min and max are optional. if not provided, we use the min/max of the range of data. */
  min?: number;
  
  /** min and max are optional. if not provided, we use the min/max of the range of data. */
  max?: number;

}


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

/** 
 * union, plus we're adding a state used to track application.
 * that state is serialized if it's true. 
 * we also add an internal field that will be type-specific, and not serialized.
 * 
 * ...everybody has a vertex now, we could standardize it
 * 
 */
export type ConditionalFormat = { internal?: unknown } & (
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

