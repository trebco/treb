
import type { CellStyle, EvaluateOptions, IArea, Color, Gradient, GradientStop } from 'treb-base-types';

/** 
 * conditional format predicated on an expression. if the expression 
 * evaluates to true, we apply the style. otherwise no.
 */
export interface ConditionalFormatExpression {
  type: 'expression';
  area: IArea;
  style: CellStyle;
  expression: string;
  options?: EvaluateOptions;
}

export interface ConditionalFormatGradientOptions {

  /** property defaults to fill */
  property?: 'fill'|'text';

  /** gradient stops, required */
  stops: Array<{ value: number, color: Color }>;
  
  /** min and max are optional. if not provided, we use the min/max of the range of data. */
  min?: number;
  
  /** min and max are optional. if not provided, we use the min/max of the range of data. */
  max?: number;

}

export const StandardGradientsList = {
  'red-green': {
    stops: [
      { value: 0, color: { theme: 5, tint: .5 }}, 
      { value: 1, color: { theme: 9, tint: .5 }}, 
    ] as GradientStop[],
  },
  'green-red': {
    stops: [
      { value: 0, color: { theme: 9, tint: .5 }}, 
      { value: 1, color: { theme: 5, tint: .5 }}, 
    ] as GradientStop[],
  },
} as const; 
export type StandardGradient = keyof typeof StandardGradientsList;

export interface ConditionalFormatGradient extends ConditionalFormatGradientOptions {
  type: 'gradient';
  area: IArea;

  internal?: {
    gradient: Gradient;
    min: number;
    max: number;
    range: number;
  }
}

/** 
 * union, plus we're adding a state used to track application.
 * that state is serialized if it's true. 
 * we also add an internal field that will be type-specific, and not serialized.
 */
export type ConditionalFormat = { applied?: boolean, internal?: unknown } & (
    ConditionalFormatExpression |
    ConditionalFormatGradient
  );

/**
 * the list of formats, in reverse order of precedence. as a starting
 * point we're using the naive approach, just applying everything in
 * order. that may change.
 */
export type ConditionalFormatList = ConditionalFormat[];

