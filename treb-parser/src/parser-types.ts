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

/**
 * base type, for common data (atm only ID). id is intended to support
 * a unique ID within the context of a single parse pass. (NOTE: in theory
 * you could use the 'position' field... although that's not present in
 * all cases?)
 */
export interface BaseUnit {
  id: number;
}

export interface UnitLiteralNumber extends BaseUnit {
  type: 'literal';
  position: number;
  value: number;
  text?: string;
}
export interface UnitLiteralString extends BaseUnit {
  type: 'literal';
  position: number;
  value: string;
  text?: string;
}
export interface UnitLiteralBoolean extends BaseUnit {
  type: 'literal';
  position: number;
  value: boolean;
  text?: string;
}

/**
 * expression unit representing a literal: string, number, boolean.
 * FIXME: would be nice if we had subtypes so we could specify
 * /
export interface UnitLiteral extends BaseUnit {
  type: 'literal';
  position: number;
  value: string | boolean | number;
  text?: string;
}
*/
export type UnitLiteral = UnitLiteralNumber|UnitLiteralBoolean|UnitLiteralString;

/**
 * testing: complex
 */
export interface UnitComplex extends BaseUnit {
  type: 'complex';
  position: number;
  real: number;
  imaginary: number;
  text?: string;

  /** 
   * this flag takes the place of the old "imaginary" unit type;
   * it's an indication that this unit has been composited, so don't
   * do it again. not sure this is actually needed by the parser... is it?
   */
  composited?: boolean;
}

/* *
 * testing: complex
 * this represents just the imaginary part. it's for internal use and should
 * never be returned as a value.
 * /
export interface UnitImaginary extends BaseUnit {
  type: 'imaginary';
  position: number;
  value: number;
  text?: string;
}
*/

/**
 * expression unit representing an array of primitive values. array
 * can contain mixed values, and holes. array cannot contain arrays,
 * or any other complex type (including complex, apparently. we should
 * remedy that).
 */
export interface UnitArray extends BaseUnit {
  type: 'array';
  position: number;
  values: Array < Array <string|boolean|number|undefined> >;
}

/**
 * expression unit representing a missing value, intended for missing
 * arguments in function calls.
 */
export interface UnitMissing extends BaseUnit {
  type: 'missing';
}

/**
 * expression unit representing an opaque name or identifier.
 */
export interface UnitIdentifier extends BaseUnit {
  type: 'identifier';
  position: number;
  name: string;
}

/**
 * "structured reference" for offset into named table
 */
export interface UnitStructuredReference extends BaseUnit {
  type: 'structured-reference';
  label: string;
  position: number;
  table: string;

  /**
   * row refers to "this row". "all" means all values, including the 
   * header. "column" means all values except the header.
   */
  scope: 'row'|'all'|'column';
  column: string;
}

/**
 * expression unit representing a group of units; like parentheses in an
 * expression. intended to prevent precendence reordering of operations.
 */
export interface UnitGroup extends BaseUnit {
  type: 'group';
  elements: ExpressionUnit[];

  // this flag indicates whether the group was expressly inserted by
  // the user (true) or generated as part of parsing (false). that
  // information is used when unparsing (reconstructing formula).

  explicit: boolean;
}

/**
 * expression unit representing a function call: has call and arguments.
 */
export interface UnitCall extends BaseUnit {
  type: 'call';
  name: string;
  position: number;
  args: ExpressionUnit[];

  /** testing */
  end?: number;

}

/**
 * new call type: implicit. we might merge these.
 */
export interface UnitImplicitCall extends BaseUnit {
  type: 'implicit-call';
  position: number;
  args: ExpressionUnit[];
  call: ExpressionUnit;

}

/**
 * this isn't an output type (unless parsing fails), but it's useful
 * to be able to pass these around with the same semantics.
 */
export interface UnitOperator extends BaseUnit {
  type: 'operator';
  position: number;
  operator: string;
}

/**
 * also not an output type
 */
export interface UnitGroupSeparator extends BaseUnit {
  type: 'group-separator';
  position: number;
}

/**
 * expression unit representing a binary operation. operations may be
 * re-ordered based on precendence.
 */
export interface UnitBinary extends BaseUnit {
  type: 'binary';
  left: ExpressionUnit;
  operator: string;
  right: ExpressionUnit;
  position: number; // this is the _operator_ position, since that will be the error
}

/**
 * expression unit representing a unary operation.
 */
export interface UnitUnary extends BaseUnit {
  type: 'unary';
  operator: string;
  operand: ExpressionUnit;
  position: number;
}

/**
 * expression unit representing a spreadsheet address
 */
export interface UnitAddress extends BaseUnit {
  type: 'address';
  sheet?: string;
  sheet_id?: number;
  label: string;
  row: number;
  column: number;
  absolute_row?: boolean;
  absolute_column?: boolean;

  /** spill flag (address ends with #) */
  spill?: boolean;

  /** 
   * this means the row is a relative offset from the current row. this 
   * happens if you use R1C1 syntax with square brackets. 
   */
  offset_row?: boolean;

  /** 
   * this means the column is a relative offset from the current column. 
   * this happens if you use R1C1 syntax with square brackets. 
   */
  offset_column?: boolean;

  /** the formula was originally in R1C1. we probably want to translate it. */
  r1c1?: boolean;

  position: number;
}

/**
 * expression unit representing a spreadsheet range
 */
export interface UnitRange extends BaseUnit {
  type: 'range';
  label: string;
  start: UnitAddress;
  end: UnitAddress;
  position: number;
}

export interface UnitDimensionedQuantity extends BaseUnit {
  type: 'dimensioned';
  expression: BaseExpressionUnit; // <!-- does not support recursive DQs
  unit: UnitIdentifier;
}

/** 
 * discriminated union. this version allows any expression unit _except_ dimensioned quantity
 */
export type BaseExpressionUnit =
| UnitLiteral
| UnitComplex
| UnitArray
| UnitIdentifier
| UnitCall
| UnitImplicitCall
| UnitMissing
| UnitGroup
| UnitOperator
| UnitGroupSeparator
| UnitBinary
| UnitUnary
| UnitAddress
| UnitRange
| UnitStructuredReference
;

/** 
 * discriminated union for type guards, all types
 */
export type ExpressionUnit =
  | BaseExpressionUnit
  | UnitDimensionedQuantity;

/** list of addresses and ranges in the formula, for graphs */
export interface DependencyList {
  addresses: { [index: string]: UnitAddress };
  ranges: { [index: string]: UnitRange };
}

/**
 * argument separator type for i18n
 */
export enum ArgumentSeparatorType {
  Comma = ',',
  Semicolon = ';',
}

/**
 * decimal mark for i18n
 */
export enum DecimalMarkType {
  Period = '.',
  Comma = ',',
}

/**
 * compound result of a parse operation includes dependency list
 * and an error flag (inverted)
 */
export interface ParseResult {
  expression?: ExpressionUnit;
  valid: boolean;
  error_position?: number;
  error?: string;
  dependencies: DependencyList;
  separator?: string;
  decimal_mark?: string;
  full_reference_list?: Array<UnitRange | UnitAddress | UnitIdentifier | UnitStructuredReference>;
}

/**
 * moving these settings into flags, but we want to ensure that 
 * they're available so we'll have some required flags
 * 
 */
export interface RequiredParserFlags {
  decimal_mark: DecimalMarkType;
  argument_separator: ArgumentSeparatorType;
}

// 

export interface OptionalParserFlags {

  /**
   * flag: support spreadsheet addresses (e.g. "A1"). this is the default,
   * as it's useful in spreadsheets. however if we want to use the parser
   * non-spreadsheet things, it might be preferable to treat things that look
   * like spreadsheet addresses as tokens instead.
   * 
   * this is default so it won't break existing behavior.
   */
  spreadsheet_semantics: boolean,

  /**
   * flag: support expressions with units, like `3mm` or `=3mm + 2in`.
   * this is for parametric modeling. testing/dev atm.
   */
  dimensioned_quantities: boolean,

  /**
   * support fractions. this is kind of a weird edge case, mostly it should
   * be handled by the value parser. (actually there might be some need for
   * separate parsing with dimensioned quantities).
   * 
   * in any case, if you type `=1/2` that should be a binary expression.
   * if you type `=3 1/2`, though, that means 3.5 and we need to treat it 
   * as such.
   * 
   * rules:
   * 
   *  - must be a binary "/" (divide) operation, with integer operands.
   *  - must be [literal integer] [fraction] where the interval must be one space.
   *  - can be negated (e.g. "-3 1/2", so that makes things more complicated.
   *  - if we do translate, translate hard so this becomes a literal number.
   *
   * ...default? since we didn't support this before, we could leave it
   * off for now. needs some more testing.
   * 
   */
  fractions: boolean,

  /**
   * support R1C1 addressing. we support absolute (`R2C3`) and relative
   * (R[-1]C[0]) addresses. can we squeeze this into the existing address
   * structure, or do we need a new structure? (...)
   */
  r1c1: boolean,

  /**
   * handle r1c1 properly, which is to say use absolute addressing
   * for absolute references and relative addressing otherwise. this should 
   * be the default, but I don't want to break anything.
   */
  r1c1_proper_semantics: boolean;

  /* *
   * what if we do want =1/2 to be a fraction? more importantly, if we are
   * using dimensioned quantities we might want =1/2C to be 0.5C, as opposed
   * to a binary operation =1 / (2C) 
   * 
   * ...
   * 
   * actually now that I think about it, that's equivalent. I was worred about
   * the concept of 1 / (2C) but logically that's the same as 2C / 4C^2 (multiply
   * numerator and denominator by denominator)) which is === (1/2)C. basically
   * as long as you only have one value with a dimension/unit, then division
   * and multiplication are a wash. it's only a concern when you have two 
   * values with dimensions/units.
   * 
   * so essentially this isn't necessary except for representation, which can
   * be handled separately.
   * 
   * ALTHOUGH, if you do that, you have to do the math before you do any 
   * unit conversion. because otherwise the ratios get screwed up.
   * 
   */
  // aggressive_fractions: false,

  /* *
   * flag: support complex numbers. it might be useful to turn this off if it 
   * conflicts with dimensioned quantities (it doesn't, really, there's no i unit).
   */
  // complex_numbers: true,

  /** string representing boolean true, for parsing/rendering */
  boolean_true?: string;

  /** string representing boolean false, for parsing/rendering */
  boolean_false?: string;

}

export type ParserFlags = Partial<OptionalParserFlags> & RequiredParserFlags;

export interface RenderOptions {
  offset: { rows: number; columns: number };

  /** 
   * render in R1C1 format. this will be relative if the R1C1 base
   * address is set; otherwise absolute. 
   */
  r1c1?: boolean;

  /** base for offsetting relative R1C1 addresses */
  r1c1_base?: UnitAddress;

  /** force addresses to be relative */
  r1c1_force_relative?: boolean;

  /**
   * handle r1c1 properly, which is to say use absolute addressing
   * for absolute references and relative addressing otherwise (assuming
   * there's a base set). this should be the default, but I don't want
   * to break anything.
   */
  r1c1_proper_semantics?: boolean;

  /** if we're just translating, don't have to render addresses */
  pass_through_addresses?: boolean;

  missing: string;
  convert_decimal: DecimalMarkType;
  convert_argument_separator: ArgumentSeparatorType;
  convert_imaginary_number: 'i'|'j';
  long_structured_references: boolean;
  table_name: string;

  boolean_true?: string;
  boolean_false?: string;

}

/*
export interface PersistedParserConfig {
  flags: Partial<ParserFlags> & RequiredParserFlags;
  // argument_separator: ArgumentSeparatorType;
  // decimal_mark: DecimalMarkType;
}
*/

export const DefaultParserConfig: ParserFlags = {
  spreadsheet_semantics: true,
  dimensioned_quantities: false,
  fractions: true,
  decimal_mark: DecimalMarkType.Period,
  argument_separator: ArgumentSeparatorType.Comma,
  boolean_true: 'TRUE',
  boolean_false: 'FALSE',
};

