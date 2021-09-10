
/**
 * this is, for the moment, hand-curated. can we reuse the regular API tool?
 * ...
 */

export interface Complex {
  real: number;
  imaginary: number;
}

export declare enum Hints {
  None = 0,
  Nan = 1,
  Exponential = 2,
  Percent = 4,
  Currency = 8,
  Grouping = 16,
  Parens = 32,
  Date = 64,
  Time = 128
}

export declare enum ValueType {
  undefined = 0,
  formula = 1,
  string = 2,
  number = 3,
  boolean = 4,
  object = 5,
  error = 6,
  complex = 7,
  array = 8
}

export declare const GetValueType: (value: unknown) => ValueType;

export interface ParseResult {
  value: number | string | boolean | undefined | Complex;
  hints?: Hints;
  type: ValueType;
}

declare class ValueParserType {
  TryParse(text?: string): ParseResult;
}

export declare const ValueParser: ValueParserType;

export declare class NumberFormat {
  Format(value: any, text_width?: number): string;
}
  
export declare class NumberFormatCache {
  static Get(format: string, complex?: boolean): NumberFormat;
}

