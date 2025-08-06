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
 * Copyright 2022-2025 trebco, llc. 
 * info@treb.app
 * 
 */

import type {
  ExpressionUnit,
  UnitAddress,
  UnitIdentifier,
  UnitOperator,
  UnitRange,
  UnitArray,
  UnitUnary,
  DependencyList,
  ParseResult,
  UnitLiteral,
  UnitLiteralNumber,
  ParserFlags,
  UnitStructuredReference,
  RenderOptions,
  BaseExpressionUnit,
} from './parser-types';

import {
  ArgumentSeparatorType,
  DecimalMarkType,
  DefaultParserConfig
} from './parser-types';

interface PrecedenceList {
  [index: string]: number;
}

/**
 * regex determines if a sheet name requires quotes. centralizing
 * this to simplify maintenance and reduce overlap/errors
 */
export const QuotedSheetNameRegex = /[\s-+=<>!()]/;

/**
 * similarly, illegal sheet name. we don't actually handle this in
 * the parser, but it seems like a reasonable place to keep this
 * definition.
 */
export const IllegalSheetNameRegex = /['*\\]/;

const DOUBLE_QUOTE = 0x22; // '"'.charCodeAt(0);
const SINGLE_QUOTE = 0x27; // `'`.charCodeAt(0);

const NON_BREAKING_SPACE = 0xa0;
const SPACE = 0x20;
const TAB = 0x09;
const CR = 0x0a;
const LF = 0x0d;

const ZERO = 0x30;
const NINE = 0x39;
const PERIOD = 0x2e;

const PLUS = 0x2b;
const MINUS = 0x2d;

const OPEN_PAREN = 0x28;
const CLOSE_PAREN = 0x29;

const COMMA = 0x2c;
const PERCENT = 0x25;

const UNDERSCORE = 0x5f;
const DOLLAR_SIGN = 0x24;

const OPEN_BRACE = 0x7b;
const CLOSE_BRACE = 0x7d;

const OPEN_SQUARE_BRACKET = 0x5b;
const CLOSE_SQUARE_BRACKET = 0x5d;

const QUESTION_MARK = 0x3f;
const EXCLAMATION_MARK = 0x21;
// const COLON = 0x3a; // became an operator
const SEMICOLON = 0x3b;

const HASH = 0x23;  // #
const AT = 0x40;    // @

const UC_A = 0x41;
const LC_A = 0x61;
const UC_E = 0x45;
const LC_E = 0x65;
const UC_Z = 0x5a;
const LC_Z = 0x7a;

const LC_I = 0x69;
// const LC_J = 0x6a;

// there are a couple of characters we don't want in this 
// range; we should split into separate ranges. also we 
// probably have characters we don't need (atm)

const ACCENTED_RANGE_START = 192;
const ACCENTED_RANGE_END = 382; // bumping up for polish // 312;

/**
 * precedence map
 */
const binary_operators_precendence: PrecedenceList = {
  '==': 6,
  '!=': 6, // FIXME: we should not support these (legacy)
  '<>': 6,
  '=': 6, // these are the appropriate equality operators for SL
  '<': 7,
  '>': 7,
  '<=': 7,
  '>=': 7,
  '+': 9,
  '-': 9,
  '&': 9,
  '*': 10,
  '/': 10,
  '^': 11, // highest math op
  ':': 13, // range operator
};

/* *
 * binary ops are sorted by length so we can compare long ops first
   switching to a composite w/ unary operators
 * /
const binary_operators = Object.keys(binary_operators_precendence).sort(
  (a, b) => b.length - a.length,
);

/**
 * unary operators. atm we have no precedence issues, unary operators
 * always have absolute precedence. (for numbers, these are properly part
 * of the number, but consider `=-SUM(1,2)` -- this is an operator).
 * 
 * implicit intersection operator should now have precedence over +/-.
 */
const unary_operators: PrecedenceList = { '@': 50, '-': 100, '+': 100 };

/**
 * to avoid the double - and +, we're just adding our one extra unary
 * operator. doing this dynamically would be silly, although this does
 * make this code more fragile.
 */
const composite_operators: string[] = [...Object.keys(binary_operators_precendence), '@'].sort((a, b) => b.length - a.length);

/**
 * parser for spreadsheet language.
 *
 * FIXME: this is stateless, think about exporting a singleton.
 *
 * (there is internal state, but it's only used during a Parse() call,
 * which runs synchronously). one benefit of using a singleton would be
 * consistency in decimal mark, we'd only have to set once.
 *
 * FIXME: the internal state is starting to grate. there's no reason for
 * it and it just confuses things because parsing is stateless (except for
 * configuration). internal state just keeps results from the last parse
 * operation. we should refactor so parsing is clean and returns all 
 * results directly, caller can store if necessary.
 * 
 * FIXME: split rendering into a separate class? would be a little cleaner.
 * 
 * FIXME: we don't currently handle full-width punctuation. it would be 
 * simple to parse, a little more complicated to keep track of if we wanted
 * to be able to rewrite. TODO/FIXME.
 * 
 */
export class Parser {
 
  /** 
   * accessor replacing old field. the actual value is moved to flags,
   * and should be set via the SetLocaleSettings method.
   */
  public get argument_separator(): ArgumentSeparatorType {
    return this.flags.argument_separator;
  }

  /** 
   * accessor replacing old field. the actual value is moved to flags,
   * and should be set via the SetLocaleSettings method.
   */
  public get decimal_mark(): DecimalMarkType {
    return this.flags.decimal_mark;
  }

  /**
   * unifying flags
   */
  public flags: ParserFlags = {
    ...DefaultParserConfig,
  };

  /** 
   * FIXME: why is this a class member? at a minimum it could be static 
   * FIXME: why are we doing this with a regex?
   */
  protected r1c1_regex = /[rR]((?:\[[-+]{0,1}\d+\]|\d*))[cC]((?:\[[-+]{0,1}\d+\]|\d*))$/;

  /**
   * internal argument separator, as a number. this is set internally on
   * parse call, following the argument_separator value.
   */
  protected argument_separator_char = COMMA;

  /**
   * internal decimal mark, as a number.
   */
  protected decimal_mark_char = PERIOD;

  /**
   * imaginary number value. this is "i", except for those EE weirdos who 
   * use "j". although I guess those guys put it in front, so it won't really
   * work anyway... let's stick with "i" for now.
   */
  protected imaginary_char: 0x69|0x6A = LC_I;

  /**
   * imaginary number as text for matching
   */
  protected imaginary_number: 'i'|'j' = 'i';

  /**
   * internal counter for incrementing IDs
   */
  protected id_counter = 0;

  protected expression = '';
  protected data: number[] = [];
  protected index = 0;
  protected length = 0;

  /** success flag */
  protected valid = true;

  /** rolling error state */
  protected error_position: number | undefined;

  /** rolling error state */
  protected error: string | undefined;

  protected dependencies: DependencyList = {
    addresses: {},
    ranges: {},
  };

  // referenced addresses -- used to merge ranges/addresses, although I'm
  // not sure that's actually all that useful
  protected address_refcount: { [index: string]: number } = {};

  /**
   * full list of referenced addresses and ranges. we're adding this
   * to support highlighting, for which we need multiple instances
   * of a single address. the original dep list was used for graph dependencies,
   * so we compressed the list.
   *
   * FIXME: use a single list, i.e. something like
   *
   *   address -> [instance, instance]
   *
   * because that's a big API change it's going to have to wait. for now,
   * use a second list.
   *
   * UPDATE: adding (otherwise unused) tokens, which could be named ranges.
   * in the future we may pass in a list of names at parse time, and resolve
   * them; for now we are just listing names.
   */
  protected full_reference_list: Array<UnitAddress | UnitRange | UnitIdentifier | UnitStructuredReference> = [];

  /**
   * cache for storing/restoring parser state, if we toggle it
   */
  protected parser_state_cache: string[] = [];

  /**
   * step towards protecting these values and setting them in one
   * operation. 
   * 
   * UPDATE: switch order. argument separator is optional and implied.
   */
  public SetLocaleSettings(decimal_mark: DecimalMarkType, argument_separator?: ArgumentSeparatorType) {

    if (typeof argument_separator === 'undefined') {
      argument_separator = (decimal_mark === DecimalMarkType.Comma) ? 
        ArgumentSeparatorType.Semicolon : 
        ArgumentSeparatorType.Comma ;
    }

    // I suppose semicolon and period is allowable, although no one 
    // uses it. this test only works because we know the internal type
    // representation, but that's fragile and not a good idea. FIXME

    if ((argument_separator as string) === (decimal_mark as string)) {
      throw new Error('invalid locale setting');
    }

    this.flags.argument_separator = argument_separator;
    this.flags.decimal_mark = decimal_mark;
  }

  /**
   * save local configuration to a buffer, so it can be restored. we're doing
   * this because in a lot of places we're caching parser flagss, changing
   * them, and then restoring them. that's become repetitive, fragile to 
   * changes or new flags, and annoying.
   * 
   * config is managed in a list with push/pop semantics. we store it as 
   * JSON so there's no possibility we'll accidentally mutate.
   * 
   * FIXME: while we're at it why not migrate the separators -> flags, so
   * there's a single location for this kind of state? (...TODO)
   * 
   */
  public Save() {
    this.parser_state_cache.push(JSON.stringify(this.flags));
  }

  /**
   * restore persisted config
   * @see Save
   */
  public Restore() {
    const json = this.parser_state_cache.shift();
    if (json) {
      try {
        this.flags = JSON.parse(json) as ParserFlags;
      }
      catch (err) {
        console.error(err);
      }
    }
    else {
      console.warn("No parser state to restore");
    }
  }

  /** 
   * recursive tree walk that allows substitution. this should be 
   * a drop-in replacement for the original Walk function but I'm
   * keeping it separate temporarily just in case it breaks something.
   * 
   * @param func - in this version function can return `true` (continue
   * walking subtree), `false` (don't walk subtree), or an ExpressionUnit.
   * in the last case, we'll replace the original unit with the substitution.
   * obviously in that case we don't recurse.
   */
  public Walk2(unit: ExpressionUnit, func: (unit: ExpressionUnit) => boolean|ExpressionUnit|undefined): ExpressionUnit {

    const result = func(unit);
    if (typeof result === 'object') {
      return result;
    }

    switch (unit.type) {
      case 'address':
      case 'missing':
      case 'literal':
      case 'complex':
      case 'identifier':
      case 'operator':
      case 'structured-reference':
        break;

      case 'dimensioned':
        if (result) {
          unit.expression = this.Walk2(unit.expression, func) as BaseExpressionUnit; // could be an issue
          unit.unit = this.Walk2(unit.unit, func) as UnitIdentifier; // could be an issue
        }
        break;

      case 'range':
        if (func(unit)) {
          unit.start = this.Walk2(unit.start, func) as UnitAddress; // could be an issue
          unit.end = this.Walk2(unit.end, func) as UnitAddress; // could be an issue
        }
        break;

      case 'binary':
        if (func(unit)) {
          unit.left = this.Walk2(unit.left, func);
          unit.right = this.Walk2(unit.right, func);
        }
        break;

      case 'unary':
        if (func(unit)) {
          unit.operand = this.Walk2(unit.operand, func);
        }
        break;

      case 'group':
        if (func(unit)) {
          unit.elements = unit.elements.map(source => this.Walk2(source, func));
        }
        break;

      case 'implicit-call':
        if (func(unit)) {
          unit.call = this.Walk2(unit.call, func);
          unit.args = unit.args.map(source => this.Walk2(source, func));
        }
        break;

      case 'call':
        if (func(unit)) {
          unit.args = unit.args.map(source => this.Walk2(source, func));
        }
        break;
    }

    return unit;

  }

  /**
   * recursive tree walk.
   *
   * @param func function called on each node. for nodes that have children
   * (operations, calls, groups) return false to skip the subtree, or true to
   * traverse.
   */
  public Walk(unit: ExpressionUnit, func: (unit: ExpressionUnit) => boolean): void {
    switch (unit.type) {
      case 'address':
      case 'missing':
      case 'literal':
      case 'complex':
      case 'identifier':
      case 'operator':
      case 'structured-reference':
        func(unit);
        return;

      case 'dimensioned':
        if (func(unit)) {
          this.Walk(unit.expression, func);
          this.Walk(unit.unit, func);
        }
        return;

      case 'range':
        if (func(unit)) {
          this.Walk(unit.start, func);
          this.Walk(unit.end, func);
        }
        return;

      case 'binary':
        if (func(unit)) {
          this.Walk(unit.left, func);
          this.Walk(unit.right, func);
        }
        return;

      case 'unary':
        if (func(unit)) {
          this.Walk(unit.operand, func);
        }
        return;

      case 'group':
        if (func(unit)) {
          // unit.elements.forEach((element) => this.Walk(element, func));
          for (const element of unit.elements) {
            this.Walk(element, func);
          }
        }
        return;

      case 'implicit-call':
        if (func(unit)) {
          this.Walk(unit.call, func);          
          for (const arg of unit.args) {
            this.Walk(arg, func);
          }
        }
        return;

      case 'call':
        if (func(unit)) {
          for (const arg of unit.args) {
            this.Walk(arg, func);
          }
          // unit.args.forEach((arg) => this.Walk(arg, func));
        }
    }
  }

  /** utility: transpose array */
  public Transpose(arr: Array < Array <string|boolean|number|undefined> >): Array < Array <string|boolean|number|undefined> > {

    const m = arr.length;
    const transposed: Array < Array <string|boolean|number|undefined> > = [];
    let n = 0;

    for (let i = 0; i < m; i++){ 
      if (Array.isArray(arr[i])) {
        n = Math.max(n, arr[i].length);
      }
    }

    for (let i = 0; i < n; i++) {
      transposed[i] = [];
      for (let j = 0; j < m; j++) {
        transposed[i][j] = arr[j] ? arr[j][i] : undefined;
      }
    }

    return transposed;
  }

  /**
   * renders the passed expression as a string.
   * @param unit base expression
   * @param offset offset for addresses, used to offset relative addresses
   * (and ranges). this is for copy-and-paste or move operations.
   * @param missing string to represent missing values (can be '', for functions)
   * 
   * FIXME: we're accumulating too many arguments. need to switch to an 
   * options object. do that after the structured reference stuff merges.
   * 
   */
  public Render(
    unit: ExpressionUnit,
    options: Partial<RenderOptions> = {}): string {

    // defaults

    const offset = options.offset || {rows: 0, columns: 0};
    const missing = options.missing ?? '(missing)';

    // the rest are optional

  /*
    offset: { rows: number; columns: number } = { rows: 0, columns: 0 },
    missing = '(missing)',
    convert_decimal?: DecimalMarkType,
    convert_argument_separator?: ArgumentSeparatorType,
    convert_imaginary_number?: 'i'|'j',
    long_structured_references?: boolean,
    table_name?: string,

  ): string {
    */

    const { 
      convert_decimal, 
      convert_argument_separator, 
      // convert_imaginary_number, 
      long_structured_references, 
      table_name,
    } = options;

    // use default separator, unless we're explicitly converting.

    let separator = this.flags.argument_separator + ' ';
    if (convert_argument_separator === ArgumentSeparatorType.Comma) {
      separator = ', ';
    }
    else if (convert_argument_separator === ArgumentSeparatorType.Semicolon) {
      separator = '; ';
    }

    /*
    let imaginary_character = this.imaginary_number;
    if (convert_imaginary_number) {
      imaginary_character = convert_imaginary_number;
    }
    */

    // this is only used if we're converting.

    const decimal = convert_decimal === DecimalMarkType.Comma ? ',' : '.';
    const decimal_rex =
      this.flags.decimal_mark === DecimalMarkType.Comma ? /,/ : /\./;

    // we need this for complex numbers, but I don't want to change the 
    // original at the moment, just in case. we can run through that later.

    const decimal_rex_g = 
      this.flags.decimal_mark === DecimalMarkType.Comma ? /,/g : /\./g;

    switch (unit.type) {
      case 'address':
        if (options.pass_through_addresses) { 
          return unit.label;
        }
        return options.r1c1 ? this.R1C1Label(unit, options) : this.AddressLabel(unit, offset);

      case 'range':
        if (options.pass_through_addresses) { 
          return unit.label;
        }
        return options.r1c1 ? 
          this.R1C1Label(unit.start, options) + ':' + 
            this.R1C1Label(unit.end, options) : 
          this.AddressLabel(unit.start, offset) + ':' + this.AddressLabel(unit.end, offset);

      case 'missing':
        return missing;

      case 'array':

        // we have to transpose because we're column-major but the 
        // format is row-major

        return '{' +
          this.Transpose(unit.values).map((row) => row.map((value) => {
            if (typeof value === 'string') {
              return '"' + value + '"';
            }
            return value;
          }).join(', ')).join('; ') + '}';

      case 'binary':

        // in some cases we might see range constructs as binary units
        // because one side (or maybe both sides) of the range is a 
        // function. in that case we don't want a space in front of the 
        // operator.

        // UPDATE: for aesthetic reasons, also remove spaces around a
        // power operator (caret, "^")

        // FIXME: parameterize?

        {
          const separator = ((unit.operator === ':' || unit.operator === '^') ? '': ' ');

          return (
            this.Render(unit.left, options) +
            separator +
            unit.operator +
            separator +
            this.Render(unit.right, options)
          );
        }

      case 'unary':
        return (
          unit.operator +
          this.Render(unit.operand, options)
        );

      case 'complex':

        // formatting complex value (note for searching)
        // this uses small regular "i"

        // as with literals, we want to preserve the original text,
        // which might have slight precision differences from what
        // we would render.

        if (unit.text) {
          if (convert_decimal) {

            // we don't support grouping numbers for complex, so there's
            // no need to handle grouping

            const text = unit.text;
            return text.replace(decimal_rex_g, decimal);

          }
          else {
            return unit.text;
          }
        }
        else {

          // if we don't have the original text for whatever reason, format 
          // and convert if necessary.

          let imaginary_text = Math.abs(unit.imaginary).toString();
          if (convert_decimal === DecimalMarkType.Comma || this.flags.decimal_mark === DecimalMarkType.Comma) {
            imaginary_text = imaginary_text.replace(/\./, ',');
          }

          if (unit.real) {
            let real_text = unit.real.toString();
            if (convert_decimal === DecimalMarkType.Comma || this.flags.decimal_mark === DecimalMarkType.Comma) {
              real_text = real_text.replace(/\./, ',');
            }
  
            const i = Math.abs(unit.imaginary);
            return `${real_text}${unit.imaginary < 0 ? ' - ' : ' + '}${i === 1 ? '' : imaginary_text}i`;
          }
          else if (unit.imaginary === -1) {
            return `-i`;
          }
          else if (unit.imaginary === 1) {
            return `i`;
          }
          else {
            return `${unit.imaginary < 0 ? '-' : ''}${imaginary_text}i`;
          }

        }

        break;
      
      case 'literal':
        if (typeof unit.value === 'string') {

          // escape any quotation marks in string
          return '"' + unit.value.replace(/"/g, '""') + '"';
        }
        else if (typeof unit.value === 'boolean') {

          // use render option (replacement) value; then flags value; then a default

          if (unit.value) {
            return options.boolean_true || this.flags.boolean_true || 'true' ; // default
          }
          else {
            return options.boolean_false || this.flags.boolean_false || 'false' ; // default
          }

        }
        else if (convert_decimal && typeof unit.value === 'number') {
          if (unit.text) {
            // here we want to translate the literal typed-in value.
            // users can type in a decimal point and possibly grouping.
            // if we are converting from dot to comma, we need to make
            // sure to remove any existing commas. for the time being
            // we will just remove them.

            // what about the alternate case? in that case, we're not allowing
            // users to type in groupings (I think), so we can skip that part.

            // ACTUALLY, we don't allow grouping at all. we normalize it
            // if you type in a number. why? consider functions, grouping
            // looks like parameter separation. so no.

            let text = unit.text;
            if (
              convert_decimal === DecimalMarkType.Comma &&
              this.flags.decimal_mark === DecimalMarkType.Period
            ) {
              text = text.replace(/,/g, ''); // remove grouping
            }
            return text.replace(decimal_rex, decimal);
          }
          else {
            // this always works because this function is guaranteed
            // to return value in dot-decimal format without separators.

            return unit.value.toString().replace(/\./, decimal);
          }
        }
        else if (unit.text) return unit.text;
        return unit.value.toString();

      case 'identifier':
        return unit.name;

      case 'operator':
        return '[' + unit.operator + ']'; // this should be invalid output

      case 'group':
        if (unit.explicit) {
          return (
            '(' +
            unit.elements
              .map((x) => this.Render(x, options)).join(separator) +
            ')'
          );
        }
        else {
          return unit.elements
            .map((x) => this.Render(x, options)).join(separator);
        }

      case 'implicit-call':
        return this.Render(unit.call, options) + 
          '(' + unit.args.map(element => this.Render(element, options)).join(separator) + ')';

      case 'call':
        return (
          unit.name +
          '(' +
          unit.args
            .map((x) =>
              this.Render(x, options)).join(separator) +
          ')'
        );

      case 'dimensioned':
        return this.Render(unit.expression) + ' ' + this.Render(unit.unit);

      case 'structured-reference':

        // not sure of the rules around one or two braces for the 
        // column name... certainly spaces means you need at least one
      
        {
          let column = unit.column;
          if (/[^A-Za-z]/.test(column)) {
            column = '[' + column + ']';
          }

          let table = unit.table;

          // console.info("RENDER SR", unit, table_name, long_structured_references);

          if (!table && long_structured_references && table_name) {
            table = table_name;
          }

          switch (unit.scope) {
            case 'all':
              return `${table}[[#all],${column}]`;

            case 'row':
              if (long_structured_references) {
                return `${table}[[#this row],${column}]`;
              }
              else {
                return `${table}[@${column}]`;
              }

            case 'column':
              return `${table}[${column}]`;

          }

          // this is here in case we add a new scope in the future,
          // so we remember to handle this case

          throw new Error('unhandled scope in structured reference');

        }

    }

    return '??';
  }

  /**
   * parses expression and returns the root of the parse tree, plus a
   * list of dependencies (addresses and ranges) found in the expression.
   *
   * NOTE that in the new address parsing structure, we will overlap ranges
   * and addresses (range corners). this is OK because ranges are mapped
   * to individual address dependencies. it's just sloppy (FIXME: refcount?)
   */
  public Parse(expression: string): ParseResult {

    // normalize
    expression = expression.trim();

    // remove leading =
    if (expression[0] === '=') {
      expression = expression.substr(1).trim();
    }

    this.expression = expression;
    this.data = [];
    this.length = expression.length;
    this.index = 0;
    this.valid = true;
    this.error_position = undefined;
    this.error = undefined;
    this.dependencies.addresses = {};
    this.dependencies.ranges = {};
    this.address_refcount = {};
    this.full_reference_list = [];

    // reset ID
    this.id_counter = 0;

    // set separator
    switch (this.flags.argument_separator) {
      case ArgumentSeparatorType.Semicolon:
        this.argument_separator_char = SEMICOLON;
        break;
      default:
        this.argument_separator_char = COMMA;
        break;
    }

    // and decimal mark
    switch (this.flags.decimal_mark) {
      case DecimalMarkType.Comma:
        this.decimal_mark_char = COMMA;
        break;
      default:
        this.decimal_mark_char = PERIOD;
        break;
    }

    // NOTE on this function: charCodeAt returns UTF-16. codePointAt returns
    // unicode. length returns UTF-16 length. any characters that are not
    // representable as a single character in UTF-16 will be 'the first unit
    // of a surrogate pair...' and so on.
    //
    // we want UTF-16, not unicode. for the parser itself, we are only really
    // looking for ASCII, so it's not material. for anything else, if we
    // construct strings from the original data we want to map the UTF-16,
    // otherwise we will construct the string incorrectly. this applies to
    // strings, function names, and anything else.
    //
    // which is all a long way of saying, don't be tempted to replace this
    // with codePointAt.

    for (let i = 0; i < this.length; i++) {
      this.data[i] = expression.charCodeAt(i);
    }

    const expr = this.ParseGeneric();

    // last pass: convert any remaining imaginary values to complex values.
    // FIXME: could do this elsewhere? not sure we should be adding yet
    // another loop...

    // (moving)

    // remove extraneous addresses

    // NOTE: we still may have duplicates that have different absolute/relative
    // modifiers, e.g. C3 and $C$3 (and $C3 and C$3). not sure what we should
    // do about that, since some consumers may consider these different -- we
    // need to establish a contract about this

    const addresses: { [index: string]: UnitAddress } = {};
    for (const key of Object.keys(this.dependencies.addresses)) {
      if (this.address_refcount[key]) {
        addresses[key] = this.dependencies.addresses[key];
      }
    }
    this.dependencies.addresses = addresses;

    return {
      expression: expr || undefined,
      valid: this.valid,
      error: this.error,
      error_position: this.error_position,
      dependencies: this.dependencies,
      separator: this.flags.argument_separator,
      decimal_mark: this.flags.decimal_mark,
      full_reference_list: this.full_reference_list.slice(0),
    };
  }

  /** generates column label ("A") from column index (0-based) */
  protected ColumnLabel(column: number): string {
    if (column === Infinity) { return ''; }
    let s = String.fromCharCode(65 + (column % 26));
    while (column > 25) {
      column = Math.floor(column / 26) - 1;
      s = String.fromCharCode(65 + (column % 26)) + s;
    }
    return s;
  }

  /**
   * generates absolute or relative R1C1 address
   * 
   * FIXME: not supporting relative (offset) addresses atm? I'd like to
   * change this but I don't want to break anything...
   */
  protected R1C1Label(
    address: UnitAddress,
    options: Partial<RenderOptions>,
    // base?: UnitAddress,
    // force_relative = false,
  ): string {

    const force_relative = !!options.r1c1_force_relative;
    const base = options.r1c1_base;

    let label = '';

    if (address.sheet) { // && (!base?.sheet || base?.sheet !== address.sheet)) {
      label = (QuotedSheetNameRegex.test(address.sheet) ?
        '\'' + address.sheet + '\'' : address.sheet) + '!';
    }

    let row = '';
    let column = '';

    if (force_relative && options.r1c1_proper_semantics && base) {

      if (address.absolute_row) {
        row = (address.row + 1).toString();
      }
      else {
        const delta_row = address.row - base.row;
        if (delta_row) {
          row = `[${delta_row}]`;
        }
      }

      if (address.absolute_column) {
        column = (address.column + 1).toString();
      }
      else {
        const delta_column = address.column - base.column;
        if (delta_column) {
          column = `[${delta_column}]`;
        }
      }

    }
    else if (force_relative && base) { 
      const delta_row = address.row - base.row;
      const delta_column = address.column - base.column;

      if (delta_row) {
        row = `[${delta_row}]`;
      }
      if (delta_column) {
        column = `[${delta_column}]`;
      }

    }
    else {
      row = address.offset_row ? `[${address.row}]` : (address.row + 1).toString();
      column = address.offset_column ? `[${address.column}]` : (address.column + 1).toString();
    }

    /*    
    const row = (address.absolute_row || !base) ? (address.row + 1).toString() : `[${address.row - base.row}]`;
    const column = (address.absolute_column || !base) ? (address.column + 1).toString() : `[${address.column - base.column}]`;
    */

    label += `R${row}C${column}`;

    return label;
  }

  /** 
   * generates address label ("C3") from address (0-based).
   * 
   * @param offset - offset by some number of rows or columns 
   * @param r1c1 - if set, return data in R1C1 format. 
   */
  protected AddressLabel(
    address: UnitAddress,
    offset: { rows: number; columns: number },
  ): string {
    let column = address.column;
    if (!address.absolute_column && address.column !== Infinity) column += offset.columns;

    let row = address.row;
    if (!address.absolute_row && address.row !== Infinity) row += offset.rows;

    if (row < 0 || column < 0 || (row === Infinity && column === Infinity)) return '#REF';

    let label = '';
    if (address.sheet) {

      label = (QuotedSheetNameRegex.test(address.sheet) ?
        '\'' + address.sheet + '\'' : address.sheet) + '!';
    }

    if (row === Infinity) {
      return label + 
        (address.absolute_column ? '$' : '') +
        this.ColumnLabel(column);
    }

    if (column === Infinity) {
      return label + 
        (address.absolute_row ? '$' : '') +
        (row + 1)
    }

    return (
      label +
      (address.absolute_column ? '$' : '') +
      this.ColumnLabel(column) +
      (address.absolute_row ? '$' : '') +
      (row + 1) + 
      (address.spill ? '#' : '')
    );
  }

  /**
   * base parse routine; may recurse inside parens (either as grouped
   * operations or in function arguments).
   *
   * @param exit exit on specific characters
   */
  protected ParseGeneric(exit: number[] = [0], explicit_group = false): ExpressionUnit | null {
    let stream: ExpressionUnit[] = [];

    for (; this.index < this.length;) {
      const unit = this.ParseNext(stream.length === 0);

      if (typeof unit === 'number') {

        if (exit.some((test) => unit === test)) {
          break;
        }
        else if (unit === OPEN_PAREN) {

          // note that function calls are handled elsewhere,
          // so we only have to worry about grouping. parse
          // up to the closing paren...

          // actually now we have implicit calls, so we need
          // to manage that here. 

          this.index++; // open paren
          const group = this.ParseGeneric([CLOSE_PAREN], true);
          this.index++; // close paren

          // and wrap up in a group element to prevent reordering.
          // flag indicates that this is a user grouping, not ours

          // skip nulls

          // ...don't skip nulls? don't know what the rationale was
          // but for implicit calls we will need to support empty arguments 

          // if (group) {
            stream.push({
              type: 'group',
              id: this.id_counter++,
              elements: group? [group] : [],
              explicit: true,
            });
          //}

        }
        else {
          // this can probably move to PNext? except for the test
          // on looking for a binary operator? (...)

          const operator = this.ConsumeOperator();
          if (operator) {
            stream.push(operator);
          }
          else if (explicit_group && unit === this.argument_separator_char) {

            // adding a new unit type here to explicitly show we're in
            // a group; prevents later passes from treating arguments as 
            // fractions or something else. we just need to remove these
            // later

            stream.push({
              type: 'group-separator',
              position: this.index,
              id: this.id_counter++,
            });

            this.index++;
          }
          else {
            this.error = `unexpected character [1]: ${String.fromCharCode(unit)}, 0x${unit.toString(16)}`;
            this.valid = false;
            this.index++;
          }
        }
      }
      else {
        stream.push(unit);
      }
    }

    // why do we build ranges after doing reordering? since ranges
    // have the highest precedence (after complex numbers), why not
    // just run through them now? also we could merge the complex
    // composition (or not, since that's optional)

    // ...

    // OK, doing that now (testing). a side benefit is that this solves
    // one of the problems we had with complex numbers, mismatching naked
    // column identifiers like I:J. if we do ranges first we will not run
    // into that problem.

    if (stream.length) {
      
      stream = this.BinaryToRange2(stream);

      // FIXME: fractions should perhaps move, not sure about the proper 
      // ordering...

      if (this.flags.fractions) {

        // the specific pattern we are looking for for a fraction is
        //
        // literal (integer)
        // literal (integer)
        // operator (/)
        // literal (integer)
        // 

        // NOTE: excel actually translates these functions after you
        // enter them to remove the fractions. not sure why, but it's 
        // possible that exporting them to something else (lotus?) wouldn't
        // work. we can export them to excel, however, so maybe we can just
        // leave as-is.

        const rebuilt: ExpressionUnit[] = [];
        const IsInteger = (test: ExpressionUnit) => {
          return (test.type === 'literal')
            && ((typeof test.value) === 'number')
            && ((test.value as number) % 1 === 0); // bad typescript
        };

        let i = 0;
        for (; i < stream.length - 3; i++) {
          if (IsInteger(stream[i])
            && IsInteger(stream[i + 1])
            && (stream[i + 2].type === 'operator' && (stream[i+2] as UnitOperator).operator === '/')
            && IsInteger(stream[i + 3])) {

            const a = stream[i] as UnitLiteralNumber;
            const b = stream[i + 1] as UnitLiteralNumber;
            const c = stream[i + 3] as UnitLiteralNumber;
            const f = ((a.value < 0) ? -1 : 1) * (b.value / c.value);

            i += 3;
            rebuilt.push({
              id: stream[i].id,
              type: 'literal', 
              text: this.expression.substring(a.position, c.position + 1),
              value: a.value + f,
              position: a.position,
            })
          }
          else {
            rebuilt.push(stream[i]);
          }
        }
        for (; i < stream.length; i++){ 
          rebuilt.push(stream[i]);
        }

        stream = rebuilt;

      }

      // so we're moving complex handling to post-reordering, to support
      // precedence properly. there's still one thing we have to do here,
      // though: handle those cases of naked imaginary values "i". these
      // will be text identifiers, because they don't look like anything 
      // else. the previous routine will have pulled out column ranges like
      // I:I so we don't have to worry about that anymore.

      stream = stream.map(test => {
        if (test.type === 'identifier' && test.name === this.imaginary_number) {

          return {
            type: 'complex',
            real: 0,
            imaginary: 1,
            position: test.position,
            text: test.name,
            id: this.id_counter++,
          };
          
        }
        return test;
      });

      if (this.flags.dimensioned_quantities) {

        // support dimensioned quantities. we need to think a little about what 
        // should and should not be supported here -- definitely a literal 
        // followed by an identifier; definitely not two identifiers in a row; 
        // (really?) definitely not expressions followed by identifiers...
        //
        // what about
        // group: (3+2)mm [yes]
        // call: sin(3)mm [yes]
        // name?: Xmm [...]
        //
        // what about space?
        // 10 fluid ounces
        // 10 fl oz
        // 

        const rebuilt: ExpressionUnit[] = [];
        let unit: ExpressionUnit | undefined;

        for (let i = 0; i < stream.length; i++) {
        //for (const entry of stream) {
          const entry = stream[i];

          if (!unit) {
            unit = entry;
          }
          else if (entry.type === 'identifier' && (unit.type === 'literal' || unit.type === 'group' || unit.type === 'call')) {

            // check for multi-word unit (unit has spaces)

            const identifier = entry as UnitIdentifier;
            while (stream[i + 1]?.type === 'identifier') {
              identifier.name += (' ' + (stream[++i] as UnitIdentifier).name);
            }
            
            rebuilt.push({
              type: 'dimensioned',
              expression: unit,
              unit: entry as UnitIdentifier,
              id: this.id_counter++,
            });
            unit = undefined; // consume
          }
          else {
            rebuilt.push(unit);
            unit = entry;
          }
        }

        // trailer

        if (unit) {
          rebuilt.push(unit);
        }

        stream = rebuilt;

      }
      
    }

    // console.info("STREAM\n", stream, "\n\n");

    if (stream.length === 0) return null;
    if (stream.length === 1) return stream[0];

    // fix ordering of binary operations based on precedence; also
    // convert and validate ranges

    return this.BinaryToComplex(this.ArrangeUnits(stream));

  }

  /**
   * helper function, @see BinaryToRange
   * @param unit 
   * @returns 
   */
  protected UnitToAddress(unit: UnitLiteral|UnitIdentifier): UnitAddress|undefined {

    // console.info("U2", unit);

    // for literals, only numbers are valid
    if (unit.type === 'literal') {
      if (typeof unit.value === 'number' && unit.value > 0 && !/\./.test(unit.text||'')) {
        return {
          type: 'address',
          position: unit.position,
          label: unit.value.toString(),
          row: unit.value - 1,
          id: this.id_counter++,
          column: Infinity,
        };
      }
    }
    else {

      // UPDATE: sheet names... we may actually need a subparser for this?
      // or can we do it with a regex? (...)

      let sheet: string|undefined;
      let name = unit.name;

      const tokens = name.split('!');
      if (tokens.length > 1) {
        sheet = tokens.slice(0, tokens.length - 1).join('!');
        name = name.substr(sheet.length + 1);
        if (sheet[0] === '\'') {
          if (sheet.length > 1 && sheet[sheet.length - 1] === '\'') {
            sheet = sheet.substr(1, sheet.length - 2);
          }
          else {
            // console.info('mismatched single quote');
            return undefined;
          }
        }
      }

      const absolute = name[0] === '$';
      name = (absolute ? name.substr(1) : name).toUpperCase();
      const as_number = Number(name);

      // if it looks like a number, consider it a number and then be strict
      if (!isNaN(as_number)) {
        if (as_number > 0 && as_number !== Infinity && !/\./.test(name)) {
          return {
            type: 'address',
            position: unit.position,
            absolute_row: absolute,
            label: unit.name,
            row: as_number - 1,
            id: this.id_counter++,
            column: Infinity,
            sheet,
          };
        }
      }
      else if (/[A-Z]{1,3}/.test(name)) {
        
        let column = -1; // clever

        for (let i = 0; i < name.length; i++) {
          const char = name[i].charCodeAt(0);
          column = 26 * (1 + column) + (char - UC_A);
        }

        return {
          type: 'address',
          position: unit.position,
          absolute_column: absolute,
          label: unit.name,
          column,
          id: this.id_counter++,
          row: Infinity,
          sheet,
        }

      }

    }

    return undefined;
  }

  /**
   * rewrite of binary to range. this version operates on the initial stream,
   * which should be OK because range has the highest precedence so we would
   * never reorder a range.
   * 
   * ACTUALLY this will break in the case of 
   * 
   * -15:16 
   * 
   * (I think that's the only case). we can fix that though. this should
   * not impact the case of `2-15:16`, because in that case the - will look
   * like an operator and not part of the number. the same goes for a leading
   * `+` which will get dropped implicitly but has no effect (we might want
   * to preserve it for consistency though).
   * 
   * NOTE: that error existed in the old version, too, and this way is perhaps
   * better for fixing it. we should merge this into main.
   * 
   * 
   * old version comments:
   * ---
   * 
   * converts binary operations with a colon operator to ranges. this also
   * validates that there are no colon operations with non-address operands
   * (which is why it's called after precendence reordering; colon has the
   * highest preference). recursive only over binary ops AND unary ops.
   * 
   * NOTE: there are other legal arguments to a colon operator. specifically:
   * 
   * (1) two numbers, in either order
   *
   * 15:16
   * 16:16
   * 16:15
   *
   * (2) with one or both optionally having a $
   *
   * 15:$16
   * $16:$16
   *
   * (3) two column identifiers, in either order
   * 
   * A:F
   * B:A
   *
   * (4) and the same with $
   *
   * $A:F
   * $A:$F
   * 
   * because none of these are legal in any other context, we leave the 
   * default treatment of them UNLESS they are arguments to the colon 
   * operator, in which case we will grab them. that does mean we parse
   * them twice, but (...)
   * 
   * FIXME: will need some updated to rendering these, we don't have any
   * handler for rendering infinity
   */
  protected BinaryToRange2(stream: ExpressionUnit[]): ExpressionUnit[] {
    const result: ExpressionUnit[] = [];

    for (let i = 0; i < stream.length; i++) {

      const a = stream[i];
      const b = stream[i + 1];
      const c = stream[i + 2];

      let range: UnitRange|undefined;
      let label = '';

      let negative: UnitOperator|undefined; // this is a fix for the error case `-14:15`, see below

      if (a && b && c && b.type === 'operator' && b.operator === ':') {

        if (a.type === 'address' && c.type === 'address') {

          // construct a label using the full text. there's a possibility,
          // I suppose, that there are spaces (this should probably not be
          // legal). this is a canonical label, though (generated)

          // it might be better to let this slip, or treat it as an error
          // and force a correction... not sure (TODO/FIXME)

          const start_index = a.position + a.label.length;
          const end_index = c.position;

          range = {
            type: 'range',
            id: this.id_counter++,
            position: a.position,
            start: a,
            end: c,
            label:
              a.label +
              this.expression.substring(start_index, end_index) +
              c.label,
          };

          label = range.start.label + ':' + range.end.label;

          this.address_refcount[range.start.label]--;
          this.address_refcount[range.end.label]--;

          // remove entries from the list for start, stop
          const positions = [a.position, c.position];
          this.full_reference_list = this.full_reference_list.filter((test) => {
            return (
              test.position !== positions[0] && test.position !== positions[1]
            );
          });

        }
        else if ((a.type === 'literal' || a.type === 'identifier')
                && (c.type === 'literal' || c.type === 'identifier')) {

          // see if we can plausibly interpret both of these as rows or columns

          // this is a fix for the case of `-14:15`, which is kind of a rare
          // case but could happen. in that case we need to invert the first number,
          // so it parses as an address properly, and also insert a "-" which
          // should be treated as a unary operator.

          // if this happens, the first part must look like a negative number,
          // e.g. -10, so there are no leading spaces or intervening spaces
          // between the - and the value. therefore...

          let left = this.UnitToAddress(a);
          if (!left && a.type === 'literal' && typeof a.value === 'number' && a.value < 0) {
            const test = {
              ...a,
              text: (a.text || '').replace(/^-/, ''), // <- ...sign always in position 0
              position: a.position + 1, // <- ...advance 1
              value: -a.value, // <- ...invert value
            };
            left = this.UnitToAddress(test);

            if (left) {

              // if that worked, we need to insert an operator into the
              // stream to reflect the - sign. we use the original position.

              negative = {
                type: 'operator',
                operator: '-',
                position: a.position,
                id: this.id_counter++,
              }
            }

          }

          const right = this.UnitToAddress(c);

          // and they need to match

          if (left && right
              && ((left.column === Infinity && right.column === Infinity)
                  || (left.row === Infinity && right.row === Infinity))) {

            label = left.label + ':' + right.label;

            // we don't support out-of-order ranges, so we should correct.
            // they just won't work otherwise. (TODO/FIXME)
          
            range = {
              type: 'range',
              id: this.id_counter++,
              position: left.position,
              start: left,
              end: right,
              label,
            };

          }
        }

      }

      if (range) {

        if (negative) {
          result.push(negative);
        }

        result.push(range);
        this.dependencies.ranges[label] = range;
        this.full_reference_list.push(range);

        // skip
        i += 2;
      }
      else {
        result.push(a);
      }

    }

    return result;
  }

  /**
   * we've now come full circle. we started with handling ranges as 
   * binary operators; then we added complex composition as a first-pass
   * function; then we moved ranges to a first-pass function; and now we're
   * moving complex composition to a lower-level restructuring of binary
   * operations.
   * 
   * that allows better precedence handling for (potentially) ambiguous
   * constructions like =B3 * 2 + 3i. we do have parens, so.
   * 
   * @param unit 
   * @returns 
   */
  protected BinaryToComplex(unit: ExpressionUnit): ExpressionUnit {

    if (unit.type === 'binary'){
      if ((unit.operator === '+' || unit.operator === '-')
          && unit.left.type === 'literal' 
          && typeof unit.left.value === 'number'
          && unit.right.type === 'complex' // 'imaginary') {
          && !unit.right.composited ){

        // ok, compose
        // console.info("WANT TO COMPOSE", unit);

        let text = '';

        text = this.expression.substring(unit.left.position, unit.right.position + (unit.right.text?.length || 0));

        let imaginary_value = unit.right.imaginary;

        if (unit.operator === '-') {
          imaginary_value = -imaginary_value;
        }

        return {
          type: 'complex',
          position: unit.left.position,
          text: text, 
          id: this.id_counter++,
          imaginary: imaginary_value,
          real: unit.left.value,
          composited: true,
        };

      }
      else {
        unit.left = this.BinaryToComplex(unit.left);
        unit.right = this.BinaryToComplex(unit.right);
      }
    }
    else if (unit.type === 'unary' && 
            (unit.operator === '-' || unit.operator === '+') &&
             unit.operand.type === 'complex' &&
             unit.operand.text === this.imaginary_number ) {

      // sigh... patch fix for very special case of "-i"
      // actually: why do I care about this? we could let whomever is using
      // the result deal with this particular case... although it's more
      // properly our responsibility if we are parsing complex numbers.

      // we only have to worry about mischaracterizing the range label, 
      // e.g. "-i:j", but we should have already handled that in a prior pass.

      return {
        ...unit.operand,
        position: unit.position,
        text: this.expression.substring(unit.position, unit.operand.position + (unit.operand.text || '').length),
        imaginary: unit.operand.imaginary * (unit.operator === '-' ? -1 : 1),
      };

    }

    return unit;

  }


  /**
   * reorders operations for precendence
   * 
   * this method was written with the assumption that groups were
   * always an error. that's no longer true, with implicit calls.
   * we should still error if it's not an _explicit_ group, i.e. there's
   * just a bunch of naked tokens.
   * 
   */
  protected ArrangeUnits(stream: ExpressionUnit[]): ExpressionUnit {

    // probably should not happen
    if (stream.length === 0) return { type: 'missing', id: this.id_counter++ };

    // this is probably already covered
    if (stream.length === 1) return stream[0];

    const stack: ExpressionUnit[] = [];

    // work left-to-right (implied precendence), unless there
    // is actual precendence. spreadsheet language only supports
    // binary operators, so we always expect unit - operator - unit
    //
    // UPDATE: that's incorrect. SL supports unary + and - operators.
    // which makes this more complicated.
    //
    // we explicitly support unfinished expressions for the first pass
    // to build dependencies, but if they're invalid the resulting
    // parse tree isn't expected to be correct. in that case we
    // generally will pass back a bag of parts, with a flag set.

    for (let index = 0; index < stream.length; index++) {
      let element = stream[index];

      if (element.type === 'group-separator') {
        continue; // drop 
      }

      // given that we need to support unary operators, the logic needs
      // to be a little different. operators are OK at any position, provided
      // we can construct either a unary or binary operation.

      if (element.type === 'operator') {
        if (stack.length === 0 || stack[stack.length - 1].type === 'operator') {
          // valid if unary operator and we can construct a unary operation.
          // in this case we do it with recursion.

          if (unary_operators[element.operator]) {
            
            const right = this.BinaryToComplex(this.ArrangeUnits(stream.slice(index + 1)));

            // this ensures we return the highest-level group, even if we recurse
            if (!this.valid) {
              return {
                type: 'group',
                id: this.id_counter++,
                elements: stream,
                explicit: false,
              };
            }

            // if it succeeded, then we need to apply the unary operator to
            // the result, or if it's a binary operation, to the left-hand side
            // (because we have precedence) -- unless it's a range [this is now
            // handled above]

            if (right.type === 'binary') {
              right.left = {
                type: 'unary',
                id: this.id_counter++,
                operator: element.operator,
                operand: right.left,
                position: element.position,
              } as UnitUnary;
              element = right;
            }
            else {
              // create a unary operation which will replace the element
              element = {
                type: 'unary',
                id: this.id_counter++,
                operator: element.operator,
                operand: right,
                position: element.position,
              } as UnitUnary;
            }

            // end loop after this pass, because the recurse consumes everything else
            index = stream.length;
          }
          else {
            this.error = `unexpected character [2]: ${element.operator}`;
            this.error_position = element.position;
            this.valid = false;
            return {
              type: 'group',
              id: this.id_counter++,
              elements: stream,
              explicit: false,
            };
          }
        }
        else {
          stack.push(element);
          continue;
        }
      }

      //
      // why is this 2? are we thinking about combining complex numbers?
      // or ranges? (those would be binary). or was this for dimensioned
      // quantities? [actually that makes sense] [A: no, it wasn't that]
      //
      // actually what's the case where this is triggered and it's _not_
      // an error? can we find that?
      // 

      if (stack.length < 2) { 

        // we know that `element` is not an operator, because we 
        // would have consumed it

        if (stack.length === 1) {
          const a = stack[0].type;

          // support for lambdas

          if (element.type === 'group' && element.explicit) {
            if (a === 'address' || a === 'call' || a === 'identifier' || a === 'implicit-call') {

              // our parser seems to create implicit groups from these
              // values in parens. we should fix that, but we can unpack it.

              let args = element.elements;
              if (args.length === 1 && args[0].type === 'group' && !args[0].explicit) {
                args = args[0].elements;
              }
              
              // create an implicit call. replace on the stack.

              stack[0] = {
                type: 'implicit-call',
                call: stack[0],
                args,
                id: this.id_counter++,
                position: stack[0].position,
              };

              continue;

            }
          }
          /*
          else if (a !== 'operator') {

            // console.warn("unexpected element", stack[0], element);

            this.error = `unexpected element [3]: ${element.type}`;
            this.error_position = (element.type === 'missing' || element.type === 'group' || element.type === 'dimensioned') ? -1 : element.position;
            this.valid = false;
            return {
              type: 'group',
              id: this.id_counter++,
              elements: stream,
              explicit: false,
            };

          }
          */

        }
        
        stack.push(element);
      }
      else if (stack[stack.length - 1].type === 'operator') {
        const left = stack[stack.length - 2];
        const operator_unit = stack[stack.length - 1] as UnitOperator;
        const operator = operator_unit.operator;

        // assume we can construct it as follows: [A op B]

        const operation: ExpressionUnit = {
          type: 'binary',
          id: this.id_counter++,
          left,
          operator,
          position: operator_unit.position,
          right: element,
        };

        // we have to reorder if left (A) is a binary operation, and the
        // precedence of the new operator is higher. note that we will
        // deal with range operations later, for now just worry about
        // operator precedence

        if (
          left.type === 'binary' &&
          binary_operators_precendence[operator] >
          binary_operators_precendence[left.operator]
        ) {
          // so we have [[A op1 B] op2 C], and we need to re-order this into [A op1 [B op2 C]].

          operation.left = left.left; // <- A
          operation.operator = left.operator; // <- op1
          operation.position = left.position;
          operation.right = {
            type: 'binary',
            id: this.id_counter++,
            left: left.right, // <- B
            right: element, // <- C
            operator, // <- op2
            position: operator_unit.position,
          };
        }

        stack.splice(-2, 2, operation);
      }
      else {

        /*
        this.error = `multiple expressions`;
        this.error_position = (element as {position?: number}).position;
        this.valid = false;
        return {
          type: 'group',
          id: this.id_counter++,
          elements: stream,
          explicit: false,
        };
        */

        stack.push(element);

      }
    }

    if (stack.length > 1) {
      return {
        type: 'group',
        id: this.id_counter++,
        elements: stack,
        explicit: false,
      };
    }

    return stack[0];
  }

  /**
   * parses literals and tokens from the stream, ignoring whitespace,
   * and stopping on unexpected tokens (generally operators or parens).
   *
   * @param naked treat -/+ as signs (part of numbers) rather than operators.
   */
  protected ParseNext(naked = true): ExpressionUnit | number {

    this.ConsumeWhiteSpace();

    const char = this.data[this.index];
    if (char === DOUBLE_QUOTE) {
      return {
        type: 'literal',
        id: this.id_counter++,
        position: this.index,
        value: this.ConsumeString(),
      };
    }
    else if ((char >= ZERO && char <= NINE) || char === this.decimal_mark_char) {
      return this.ConsumeNumber();
    }
    else if (char === OPEN_BRACE) {
      return this.ConsumeArray();
    }
    else if (naked && (char === MINUS || char === PLUS)) {

      // there's a case where you type '=-func()', which should support
      // '=+func()' as well, both of which are naked operators and not numbers.
      // the only way to figure this out is to check for a second number char.

      // this is turning into lookahead, which we did not want to do...

      const check = this.data[this.index + 1];
      if (
        (check >= ZERO && check <= NINE) ||
        check === this.decimal_mark_char
      ) {
        return this.ConsumeNumber();
      }
    }
    else if (
      (char >= UC_A && char <= UC_Z) ||
      (char >= LC_A && char <= LC_Z) ||
      char === UNDERSCORE ||
      char === HASH || // new: only allowed in position 1, always an error
      char === SINGLE_QUOTE ||
      char === DOLLAR_SIGN ||

      // we used to not allow square brackets to start tokens, because
      // we only supported them for relative R1C1 references -- hence you'd
      // need the R first. but we now allow them for "structured references".

      char === OPEN_SQUARE_BRACKET ||
      
      (char >= ACCENTED_RANGE_START && char <= ACCENTED_RANGE_END) // adding accented characters, needs some testing
    ) {

      return this.ConsumeToken(char);
    }

    // else throw(new Error('Unexpected character: ' + char));
    return char;
  }

  protected ConsumeArray(): ExpressionUnit {

    const expression: UnitArray = {
      type: 'array',
      id: this.id_counter++,
      values: [],
      position: this.index,
    };

    this.index++;

    let row = 0;
    let column = 0;

    while (this.index < this.length) {
      const item = this.ParseNext();
      const start_position = this.index;

      if (typeof item === 'number') {
        this.index++;
        switch (item) {

          case SEMICOLON:
            //column = 0;
            //row++;
            column++;
            row = 0;
            break;

          case COMMA:
            //column++;
            row++;
            break;

          case CLOSE_BRACE:
            return expression;

          default:
            if (this.valid) {
              this.error = `invalid character in array literal`;
              this.error_position = start_position;
              this.valid = false;
            }
            break;
        }
      }
      else {
        switch (item.type) {
          case 'literal':
            if (!expression.values[row]) { expression.values[row] = []; }
            expression.values[row][column] = item.value;
            break;
          default:
            if (this.valid) {
              this.error = `invalid value in array literal`;
              this.error_position = start_position;
              this.valid = false;
            }
            break;
        }
      }
    }

    return expression;

  }

  protected ConsumeOperator(): ExpressionUnit | null {
    for (const operator of composite_operators) {
      if (this.expression.substr(this.index, operator.length) === operator) {
        const position = this.index;
        this.index += operator.length;
        return {
          type: 'operator',
          id: this.id_counter++,
          operator,
          position,
        };
      }
    }
    return null;
  }

  /** consume function arguments, which can be of any type */
  protected ConsumeArguments(): ExpressionUnit[] {
    this.index++; // open paren

    let argument_index = 0;
    const args: ExpressionUnit[] = [];

    for (; this.index < this.length;) {
      const unit = this.ParseGeneric([
        this.argument_separator_char,
        CLOSE_PAREN,
      ]);
      if (null !== unit) args.push(unit);

      // why did parsing stop?
      const char = this.data[this.index];

      if (char === this.argument_separator_char) {
        this.index++;
        argument_index++;
        for (let i = args.length; i < argument_index; i++) {
          args.push({ type: 'missing', id: this.id_counter++ });
        }
      }
      else if (char === CLOSE_PAREN) {
        this.index++;
        return args;
      }
      // else console.info('UNEXPECTED (CA)', char);
    }

    return args;
  }

  /**
   * consume token. also checks for function call, because parens
   * have a different meaning (grouping/precedence) when they appear
   * not immediately after a token.
   *
   * regarding periods: as long as there's no intervening whitespace
   * or operator, period should be a valid token character. tokens
   * cannot start with a period.
   *
   * NOTE: that's true irrespective of decimal mark type.
   *
   * you can have tokens (addresses) with single quotes; these are used
   * to escape sheet names with spaces (which is a bad idea, but hey). this
   * should only be legal if the token starts with a single quote, and only
   * for one (closing) quote.
   * 
   * R1C1 relative notation uses square brackets, like =R2C[-1] or =R[-1]C[-2].
   * that's pretty easy to see. there's also regular R1C1, like =R1C1.
   * 
   * "structured references" use square brackets. they can start with 
   * square brackets -- in that case the table source is implicit (has to
   * be in the table). otherwise they look like =TableName[@ColumnName]. that
   * @ is optional and (I think) means don't spill.
   * 
   */
  protected ConsumeToken(initial_char: number): ExpressionUnit {

    const token: number[] = [initial_char];
    const position = this.index;

    let single_quote = (initial_char === SINGLE_QUOTE);
    let square_bracket = 0; // now balancing // false; // this one can't be initial

    // this is a set-once flag for square brackets; it can 
    // short-circuit the check for structured references. 
    let braces = false; 

    // also watch first char
    if (initial_char === OPEN_SQUARE_BRACKET) {
      square_bracket = 1;
      braces = true;
    }

    for (++this.index; this.index < this.length; this.index++) {
      const char = this.data[this.index];
      if (
        (char >= UC_A && char <= UC_Z) ||
        (char >= LC_A && char <= LC_Z) ||
        (char >= ACCENTED_RANGE_START && char <= ACCENTED_RANGE_END) ||
        char === UNDERSCORE ||
        char === DOLLAR_SIGN ||
        char === PERIOD ||
        char === EXCLAMATION_MARK ||
        single_quote || // ((char === SINGLE_QUOTE || char === SPACE) && single_quote) ||
        (char >= ZERO && char <= NINE) // tokens can't start with a number, but this loop starts at index 1

        // we now allow square brackets for structured references; 
        // minus is still only allowed in R1C1 references, so keep
        // that restriction

        || char === OPEN_SQUARE_BRACKET
        || (square_bracket > 0 && char === CLOSE_SQUARE_BRACKET)
        || (char === MINUS && this.flags.r1c1 && (square_bracket === 1))

        // the @ sign can appear after the first square bracket... 
        // but only immediately? 

        || (square_bracket > 0 && char === AT && this.data[this.index - 1] === OPEN_SQUARE_BRACKET)

        // comma can appear in the first level. this is maybe an older
        // syntax? it looks like `Table2[[#this row],[region]]

        || (square_bracket === 1 && (char === COMMA || char === SPACE))

        // structured references allow basically any character, if 
        // it's in the SECOND bracket. not sure what's up with that.

        || (square_bracket > 1)

        // I think that's all the rules for structured references.

        // testing question marks, which are legal in defined names
        // (but I think not in table names or column names)

        || (char === QUESTION_MARK && square_bracket === 0)

        // moving
        // || (char === HASH) // FIXME: this should only be allowed at the end...

        /*

        || (this.flags.r1c1 && (
          char === OPEN_SQUARE_BRACKET ||
          char === CLOSE_SQUARE_BRACKET ||
          (char === MINUS && square_bracket)
        ))
        */

        


      ) {
        token.push(char);

        if (char === OPEN_SQUARE_BRACKET) {
          // square_bracket = true;
          square_bracket++;
          braces = true;
        }
        if (char === CLOSE_SQUARE_BRACKET) {
          // square_bracket = false;
          square_bracket--;
        }

        if (char === SINGLE_QUOTE) {
          single_quote = false; // one only
        }
      }

      else break;
    }

    // hash at end only
    if (this.data[this.index] === HASH) {
      token.push(this.data[this.index++]);
    }

    const str = token.map((num) => String.fromCharCode(num)).join('');

    // special handling: unbalanced single quote (probably sheet name),
    // this is an error

    if (single_quote) { // unbalanced

      this.error = `unbalanced single quote`;
      this.error_position = position;
      this.valid = false;

      return {
        type: 'identifier',
        id: this.id_counter++,
        name: str,
        position,
      } as UnitIdentifier;

    }

    // check unbalanced square bracket as well, could be a runaway structured 
    // reference

    if (square_bracket) {

      this.error = `unbalanced square bracket`;
      this.error_position = position;
      this.valid = false;

      return {
        type: 'identifier',
        id: this.id_counter++,
        name: str,
        position,
      } as UnitIdentifier;
      
    }

    /* remove special handling

    // special handling

    if (str.toLowerCase() === 'true') {
      return {
        type: 'literal',
        id: this.id_counter++,
        value: true,
        position,
      };
    }
    if (str.toLowerCase() === 'false') {
      return {
        type: 'literal',
        id: this.id_counter++,
        value: false,
        position,
      };
    }

    */

    // function takes precendence over address? I guess so

    this.ConsumeWhiteSpace();

    // UPDATE: UNLESS the token is an address, because that's not
    // a legal function name. so change that precedence rule, address
    // comes first.

    // erm -- that's not 100% correct. LOG10 is a valid cell address
    // and a valid function name. there might be others as well.

    if (this.flags.spreadsheet_semantics) {
      const address = this.ConsumeAddress(str, position);
      if (address) return address;
    }

    // [FIXME: what about braces? (...)]

    const next_char = this.data[this.index];
    if (next_char === OPEN_PAREN) {
      const args = this.ConsumeArguments();
      return {
        type: 'call',
        id: this.id_counter++,
        name: str,
        args,
        position,
        end: this.index, // testing
      };
    }

    if (this.flags.spreadsheet_semantics) {

      // check for address. in the case of a range, we'll see an address, the
      // range operator, and a second address. that will be turned into a range
      // later.

      // moved up
      // const address = this.ConsumeAddress(str, position);
      // if (address) return address;

      // check for structured reference, if we had square brackets

      if (braces) {
        const structured = this.ConsumeStructuredReference(str, position);
        if (structured) {
          return structured;
        }
      }

    }
 
    // move true/false handling here
    // should we accept english even if it's not the active language? (...)
    
    const lc = str.toLowerCase();

    if (lc === 'true' || (this.flags.boolean_true && lc === this.flags.boolean_true.toLowerCase())) {
      return {
        type: 'literal',
        id: this.id_counter++,
        value: true,
        position,
      };
    }
    
    if (lc === 'false' || (this.flags.boolean_false && lc === this.flags.boolean_false.toLowerCase())) {
      return {
        type: 'literal',
        id: this.id_counter++,
        value: false,
        position,
      };
    }

    const identifier: UnitIdentifier = {
      type: 'identifier',
      id: this.id_counter++,
      name: str,
      position,
    };

    this.full_reference_list.push(identifier);

    return identifier;
  }

  /**
   * like ConsumeAddress, look for a structured reference.
   */
  protected ConsumeStructuredReference(token: string, position: number): UnitStructuredReference|undefined {

    // structured references look something like
    //
    // [@Column1]
    // [@[Column with spaces]]
    // [[#This Row],[Column2]]
    //
    // @ means the same as [#This Row]. there are probably other things
    // that use the # syntax, but I haven't seen them yet. 
    //
    // some observations: case is not matched for the "this row" text.
    // I think that's true of column names as well, but that's not relevant
    // at this stage. whitespace around that comma is ignored. I _think_
    // whitespace around column names is also ignored, but spaces within
    // a column name are OK, at least within the second set of brackets. 

    // const index = position;
    const token_length = token.length;

    const label = token;

    let table = '';
    let i = 0;

    for (; i < token_length; i++) {
      if (token[i] === '[') {
        token = token.substring(i);
        break;
      }
      table += token[i];
    }

    // after the table, must start and end with brackets

    if (token[0] !== '[' || token[token.length - 1] !== ']') {
      return undefined;
    }

    token = token.substring(1, token.length - 1);
    const parts = token.split(',').map(part => part.trim());

    let scope: 'row'|'all'|'column' = 'column';

    // let this_row = false;
    let column = '';

    if (parts.length > 2) {
      return undefined; // ??
    }
    else if (parts.length === 2) {
      if (/\[#this row\]/i.test(parts[0])) {
        scope = 'row';
      }
      else if (/\[#all\]/i.test(parts[0])) {
        scope = 'all';
      }
      column = parts[1];
    }
    else {
      column = parts[0];      
      if (column[0] === '@') {
        scope = 'row';
        column = column.substring(1, column.length);
      }
    }

    if (column[0] === '[' && column[column.length - 1] === ']') {
      column = column.substring(1, column.length - 1);
    }

    const reference: UnitStructuredReference = {
      type: 'structured-reference',
      id: this.id_counter++,
      label,
      position,
      scope,
      column,
      table,
    };

    // console.info(reference);

    this.full_reference_list.push(reference);

    return reference;

  }

  /**
   * consumes address. this is outside of the normal parse flow;
   * we already have a token, here we're checking if it's an address.
   *
   * this used to check for ranges as well, but we now treat ranges as
   * an operation on two addresses; that supports whitespace between the
   * tokens.
   *
   * FIXME: that means we can now inline the column/row routines, since
   * they are not called more than once
   */
  protected ConsumeAddress(
    token: string,
    position: number,
  ): UnitAddress | null {
    const index = position;
    const token_length = token.length;

    // FIXME: should mark this (!) when it hits, rather than search

    // UPDATE: ! is legal in sheet names, although it needs to be quoted.

    let sheet: string | undefined;
    const tokens = token.split('!');

    if (tokens.length > 1) {
      sheet = tokens.slice(0, tokens.length - 1).join('!');
      position += sheet.length + 1;
    }

    // handle first

    if (this.flags.r1c1) {

      const match = tokens[tokens.length - 1].match(this.r1c1_regex);
      if (match) {

        const r1c1: UnitAddress = {
          type: 'address',
          id: this.id_counter++,
          label: token, // TODO
          row: 0,
          column: 0,
          // absolute_row: false, // TODO: is this supported?
          // absolute_column: false, // TODO: is this supported?
          position: index,
          sheet,
          r1c1: true,
        };

        if (match[1][0] === '[') { // relative
          r1c1.offset_row = true;
          r1c1.row = Number(match[1].substring(1, match[1].length - 1));
        }
        else if (match[1]){ // absolute
          r1c1.row = Number(match[1]) - 1; // R1C1 is 1-based
          if (this.flags.r1c1_proper_semantics) {
            r1c1.absolute_row = true;
          }
        }
        else {
          r1c1.offset_row = true;
          r1c1.row = 0;
        }

        if (match[2][0] === '[') { // relative
          r1c1.offset_column = true;
          r1c1.column = Number(match[2].substring(1, match[2].length - 1));
        }
        else if (match[2]) { // absolute
          r1c1.column = Number(match[2]) - 1; // R1C1 is 1-based
          if (this.flags.r1c1_proper_semantics) {
            r1c1.absolute_column = true;
          }
        }
        else {
          r1c1.offset_column = true;
          r1c1.column = 0;
        }

        return r1c1;

      }
    }

    // FIXME: can inline

    const c = this.ConsumeAddressColumn(position);
    if (!c) return null;
    position = c.position;

    // things that look like an address but have row 0 are legal
    // as names. so this should be a token if r === 0.

    const r = this.ConsumeAddressRow(position);

    if (!r) return null; 
    position = r.position;

    // special hack for LOG10. ugh. can't find any other functions with
    // this problem, in english at least. btw what's the translation for
    // log10?

    if (c.column === 8508 && r.row === 9) {
      return null;
    }

    const label = sheet ?
      sheet + token.substr(sheet.length, position - index).toUpperCase() :
      token.substr(0, position - index).toUpperCase();

    if (sheet && sheet[0] === '\'') {
      sheet = sheet.substr(1, sheet.length - 2);
    }

    const addr: UnitAddress = {
      type: 'address',
      id: this.id_counter++,
      label, // : token.substr(0, position - index).toUpperCase(),
      row: r.row,
      column: c.column,
      absolute_row: r.absolute,
      absolute_column: c.absolute,
      position: index,
      sheet,
      spill: r.spill,
    };

    // if that's not the complete token, then it's invalid

    if (token_length !== position - index) return null;

    // store ref, increment count

    this.dependencies.addresses[addr.label] = addr;
    this.address_refcount[addr.label] =
      (this.address_refcount[addr.label] || 0) + 1;

    // add to new address list. use the actual object (not a clone or copy);
    // we update the list later, and we may want to remove it (if it turns
    // out it's part of a range)

    this.full_reference_list.push(addr);

    return addr;
  }

  /**
   * consumes a row, possibly absolute ($). returns the numeric row
   * (0-based) and metadata. 
   * 
   * note that something like "X0" is a legal token, because 0 is not
   * a valid row. but at the same time it can't have a $ in it. although
   * maybe "X$0" is a token but not a valid name? dunno
   */
  protected ConsumeAddressRow(position: number): 
    { 
      absolute: boolean;
      row: number;
      position: number;
      spill?: boolean; // spill reference

    }|false {

    const absolute = this.data[position] === DOLLAR_SIGN;
    if (absolute) position++;

    const start = position;
    let value = 0;

    for (; ; position++) {
      const char = this.data[position];
      if (char >= ZERO && char <= NINE) {
        value *= 10;
        value += char - ZERO;
      }
      else break;
    }

    if (start === position) {
      return false;
    }

    // handle token X0. should ~maybe~ handle this only if !absolute
    // temp leaving this separate from the above test just so it's clear
    // what we are doing

    if (value === 0) {
      return false; 
    }

    let spill = false;
    if (this.data[position] === HASH) {
      position++;
      spill = true;
    }

    return { absolute, row: value - 1, position, spill };
  }

  /**
   * consumes a column, possibly absolute ($). returns the numeric
   * column (0-based) and metadata
   */
  protected ConsumeAddressColumn(position: number):
    { 
      absolute: boolean;
      column: number;
      position: number;
    }|false {

    let column = -1; // clever
    let length = 0; // max 3 chars for column

    const absolute = this.data[position] === DOLLAR_SIGN;
    if (absolute) position++;

    for (; ; position++, length++) {
      if (length >= 4) return false; // max 3 chars for column

      const char = this.data[position];
      if (char >= UC_A && char <= UC_Z) {
        column = 26 * (1 + column) + (char - UC_A);
      }
      else if (char >= LC_A && char <= LC_Z) {
        column = 26 * (1 + column) + (char - LC_A);
      }
      else break;
    }

    if (column < 0) return false;
    return { absolute, column, position };
  }

  /**
   * consumes number. supported formats (WIP):
   *
   * -3
   * +3
   * 100.9
   * 10.0%
   * 1e-2.2
   *
   * ~1,333,123.22~
   *
   * UPDATE: commas (separators) are not acceptable in numbers passed
   * in formulae, can't distinguish between them and function argument
   * separators.
   *
   * regarding the above, a couple of rules:
   *
   * 1. +/- is only legal in position 0 or immediately after e/E
   * 2. only one decimal point is allowed.
   * 3. any number of separators, in any position, are legal, but
   *    only before the decimal point.
   * 4. only one % is allowed, and only in the last position
   *
   * NOTE: this is probably going to break on unfinished strings that
   * end in - or +... if they're not treated as operators...
   *
   * FIXME: find test cases for that so we can fix it
   *
   * UPDATE: exporting original text string for preservation/insertion.
   * this function now returns a tuple of [value, text].
   *
   * UPDATE: we now (at least in a branch) consume complex numbers. the last 
   * element of the return array is a boolean which is set if the value is an 
   * imaginary number. when parsing, we will only see the imaginary part; 
   * we'll use a separate step to put complex numbers together.
   * 
   * 
   */
  protected ConsumeNumber(): ExpressionUnit { // [number, string, boolean] {

    const starting_position = this.index;

    // for exponential notation
    let exponent = 0;
    let negative_exponent = false;

    // general
    let negative = false;
    let integer = 0;
    let decimal = 0;
    let fraction = 0;

    let state: 'integer' | 'fraction' | 'exponent' = 'integer';
    let position = 0;

    let imaginary = false;

    const start_index = this.index;

    for (; this.index < this.length; this.index++, position++) {
      const char = this.data[this.index];

      if (char === this.decimal_mark_char) {
        if (state === 'integer') state = 'fraction';
        else break; // end of token; not consuming
      }
      else if (char === PERCENT) {
        // FIXME: disallow combination of exponential and percent notation

        integer /= 100; // this is a dumb way to do this
        fraction /= 100;

        this.index++; // we are consuming
        break; // end of token
      }
      else if (char === PLUS || char === MINUS) {
        // NOTE: handling of positive/negative exponent in exponential
        // notation is handled separately, see below

        if (position === 0) {
          if (char === MINUS) negative = true;
        }
        else break; // end of token -- not consuming
      }
      else if (char === UC_E || char === LC_E) {
        if (state === 'integer' || state === 'fraction') {
          state = 'exponent';
          if (this.index < this.length - 1) {
            if (this.data[this.index + 1] === PLUS) this.index++;
            else if (this.data[this.index + 1] === MINUS) {
              this.index++;
              negative_exponent = true;
            }
          }
        }
        else break; // not sure what this is, then
      }
      else if (char === this.imaginary_char) {

        // FIXME: this should only be set if it's exactly '8i' and not '8in',
        // since we want to use that for dimensioned quantities. what's legit
        // after the i and what is not? let's exclude anything in the "word" 
        // range...

        // peek
        const peek = this.data[this.index + 1];
        if ((peek >= UC_A && peek <= UC_Z) ||
            (peek >= LC_A && peek <= LC_Z) ||
            (peek >= ACCENTED_RANGE_START && peek <= ACCENTED_RANGE_END) ||
             peek === UNDERSCORE) {

          break; // start of an identifier
        }

        // actually we could use our dimension logic instead of this... turn
        // this off when using dimensioned quantities and move it in there?

        if (state === 'integer' || state === 'fraction') {
          this.index++; // consume
          imaginary = true;
          break; // end of token
        }
      }
      else if (char >= ZERO && char <= NINE) {
        switch (state) {
          case 'integer':
            integer = integer * 10 + (char - ZERO);
            break;
          case 'fraction':
            fraction = fraction * 10 + (char - ZERO);
            decimal++;
            break;
          case 'exponent':
            exponent = exponent * 10 + (char - ZERO);
            break;
        }
      }
      else break;
    }

    // NOTE: multiplying returns fp noise, but dividing does not? need
    // to check more browsers... maybe we should store the value in some
    // other form? (that's a larger TODO)

    // let value = integer + fraction * Math.pow(10, -decimal);
    let value = integer + fraction / (Math.pow(10, decimal)); // <- this is cleaner? 

    if (state === 'exponent') {
      value = value * Math.pow(10, (negative_exponent ? -1 : 1) * exponent);
    }

    // const text = this.expression.substring(start_index, this.index) || '';
    // return [negative ? -value : value, text, imaginary];

    if (imaginary) {
      return {
        type: 'complex',
        id: this.id_counter++,
        position: starting_position,
        imaginary: negative ? -value : value,
        real: 0,
        text: this.expression.substring(start_index, this.index) || '',
      };
  
    }
    else {
      return {
        type: 'literal',
        id: this.id_counter++,
        position: starting_position,
        value: negative ? -value : value,
        text: this.expression.substring(start_index, this.index) || '',
      };
  
    }

    /*
    return {
      type: imaginary ? 'imaginary' : 'literal',
      id: this.id_counter++,
      position: starting_position,
      value: negative ? -value : value,
      text: this.expression.substring(start_index, this.index) || '',
    };
    */

  }

  /**
   * in spreadsheet language ONLY double-quoted strings are legal. there
   * are no escape characters, and a backslash is a legal character. to
   * embed a quotation mark, use "" (double-double quote); that's an escaped
   * double-quote.
   */
  protected ConsumeString(): string {
    this.index++; // open quote
    const str: number[] = [];

    for (; this.index < this.length; this.index++) {
      const char = this.data[this.index];
      if (char === DOUBLE_QUOTE) {
        // always do this: either it's part of the string (and
        // we want to skip the next one), or it's the end of the
        // string and we want to close the literal.

        this.index++;

        // check for an escaped double-quote; otherwise close the string
        // note (1) we already incremented, so check the current value,
        // and (2) it will increment again on the loop pass so it will
        // drop the extra one. I note these because this was confusing to
        // write.

        if (
          this.index >= this.length ||
          this.data[this.index] !== DOUBLE_QUOTE
        ) {
          break;
        }
      }
      str.push(char);
    }

    return str.map((char) => String.fromCharCode(char)).join('');
  }

  /** run through any intervening whitespace */
  protected ConsumeWhiteSpace(): void {
    for (; this.index < this.length;) {
      const char = this.data[this.index];
      if (
        char === SPACE ||
        char === TAB ||
        char === CR ||
        char === LF ||
        char === NON_BREAKING_SPACE
      ) {
        this.index++;
      }
      else return;
    }
  }
}
