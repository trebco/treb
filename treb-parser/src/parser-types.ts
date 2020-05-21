/**
 * base type, for common data (atm only ID). id is intended to support
 * a unique ID within the context of a single parse pass. (NOTE: in theory
 * you could use the 'position' field... although that's not present in
 * all cases?)
 */
export interface BaseUnit {
  id: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user_data?: any;
}

/**
 * expression unit representing a literal: string, number, boolean.
 */
export interface UnitLiteral extends BaseUnit {
  type: 'literal';
  position: number;
  value: string | boolean | number;
  text?: string;
}

/**
 * expression unit representing an array of primitive values. array
 * can contain mixed values, and holes. array cannot contain arrays,
 * or any other complex type.
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

/** discriminated union for type guards */
export type ExpressionUnit =
  | UnitLiteral
  | UnitArray
  | UnitIdentifier
  | UnitCall
  | UnitMissing
  | UnitGroup
  | UnitOperator
  | UnitBinary
  | UnitUnary
  | UnitAddress
  | UnitRange;

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
  full_reference_list?: Array<UnitRange | UnitAddress | UnitIdentifier>;
}
