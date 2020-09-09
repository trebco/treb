/**
 * standalone format lib is extracted from TREB (it uses some common types,
 * so it's not as simple as just compiling the module). this declaration file
 * is hand-edited to remove dependencies, so it needs to be maintained.
 */

export declare enum TextPartFlag {
  /** just render */
  default = 0,
  /** not rendered, but included in layout (spacing) */
  hidden = 1,
  /** takes up all available space */
  padded = 2,
  /** date component, needs to be filled */
  date_component = 3,
  /** special flag for minutes (instead of months), which is contextual */
  date_component_minutes = 4,
  /** literal (@): reflect the original */
  literal = 5,
  /** formatting (e.g. [red]) */
  formatting = 6
}

/**
 * TextPart is used for formatting with layout, for things like padding,
 * hidden characters, and colors
 */
export interface TextPart {
  text: string;
  flag?: TextPartFlag;
}

/**
 * number format instance
 */
export declare class NumberFormat {

  /**
   * utility method if you cache text parts
   */
  static FormatPartsAsText(parts: TextPart[], text_width?: number): string;

  /** 
   * format as string. text width is used for format-specific padding 
   * only (it will not left-pad)
   */
  Format(value: any, text_width?: number): string;

  /**
   * format as text parts for layout rendering
   */
  FormatParts(value: any): TextPart[];

}

/**
 * since users almost always make caches, we might as well
 * support a universal cache. also universal base (named) types.
 *
 * note that for this reason, you shouldn't mutate number formats.
 * mutate copies instead.
 */
export declare class NumberFormatCache {
  static Get(format: string): NumberFormat;
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
  error = 6
}

/**
 * parse result now uses base valuetype
 */
export interface ParseResult {
  value: number | string | boolean | undefined;
  hints?: Hints;
  type: ValueType;
}

/**
 * value parser class is a singleton, instance is exported
 */
declare class ValueParserType {
  /**
   * parse a string. if it can reasonably be converted to a number,
   * do that and return the number; otherwise return the original
   * string. we also return hints as to formatting, which the caller
   * may use to select a number format.
   *
   * remind me why this is better than just using a parser? (...)
   */
  TryParse(text?: string): ParseResult;
}

export declare const ValueParser: ValueParserType;
