
import { ValueType, Localization } from 'treb-base-types';
import { RDateScale } from 'treb-format';

/**
 * this is code that was in the old number format class, which was superceded
 * by the new treb-format module. we still need to do rough value parsing,
 * which is separate from parsing and from formatting.
 *
 * cleaning up to remove redundant bits, move inference in here
 */

// tslint:disable:no-bitwise

/** hints is a bitfield */
export enum Hints {
  None =        0x00,
  Nan =         0x01,
  Exponential = 0x02,
  Percent =     0x04,
  Currency =    0x08,
  Grouping =    0x10,
  Parens =      0x20,
  Date =        0x40,
  Time =        0x80,
}

/**
 * parse result now uses base valuetype
 */
export interface ParseResult {
  value: any;
  hints?: Hints;
  type: ValueType;
}

const this_year = new Date().getUTCFullYear();

/**
 * value parser class is a singleton, instance is exported
 */
class ValueParserType {

  /**
   * parse a string. if it can reasonably be converted to a number,
   * do that and return the number; otherwise return the original
   * string. we also return hints as to formatting, which the caller
   * may use to select a number format.
   *
   * remind me why this is better than just using a parser? (...)
   */
  public TryParse(s: string = ''): ParseResult {

    let hints: Hints = Hints.None;

    // starts with SINGLE quote mark. express string.
    if (s[0] === '\'') return { value: s, type: ValueType.string };

    // empty string, treat as string (should be === 0 though?)
    if (s === '') return { value: s, type: ValueType.string };

    // we test if the conversion returns NaN, which usually means
    // it's not a number -- unless the string is actually NaN, which
    // is something we want to preserve.
    if ( s === 'NaN' ) return { value: NaN, type: ValueType.number, hints: Hints.Nan };

    let x = s.trim();
    // x = x.replace(/^[\$£€]/, '').trim();

    const currency = x.match(/^[\$](.*?)$/);
    if (currency) {
      x = currency[1];
      hints |= Hints.Currency;
    }

    const parens = x.match(/^\((.*?)\)$/);
    if (parens) {
      x = parens[1];
      hints |= Hints.Parens;
    }

    const pct = x.match(/^(.*?)%\s*$/);
    if (pct) {
      x = pct[1];
      hints |= Hints.Percent;
    }

    if (Localization.decimal_separator === '.'){
      if (/,/.test(x)) {
        x = x.replace(/,/g, '');
        hints |= Hints.Grouping;
      }
    }
    else {
      x = x.replace(/(\d)\s+/g, '$1'); // remove spaces inside numbers
      x = x.replace(/\./g, ''); // remove point separators
      x = x.replace(/,/, '.'); // convert to US-style
    }

    let num = Number(x);

    if (null === num || isNaN(num)){

      // check boolean
      const lc = s.toLowerCase();
      if (lc === 'false') return { value: false, type: ValueType.boolean };
      if (lc === 'true' ) return { value: true, type: ValueType.boolean };

      // check date, but bound on reasonable years...
      // also maybe parameterize, make this optional

      const date = Date.parse(s);

      if (!isNaN(date)) {
        const check = new Date(date);
        const year = check.getUTCFullYear();

        if (year >= (this_year - 200) && year <= (this_year + 200)) {
          hints = Hints.Date;

          if (check.getHours() || check.getMinutes() || check.getSeconds()) {
            hints |= Hints.Time;
          }

          return {
            value: date / RDateScale,
            type: ValueType.number,
            hints,
          };
        }

      }

      return { value: s, type: ValueType.string };
    }

    if (parens) num = -num;
    if (pct) num = num / 100;

    if (/e/.test(s)) hints |= Hints.Exponential;
    return { value: num, type: ValueType.number, hints };

  }

}

export const ValueParser = new ValueParserType();
