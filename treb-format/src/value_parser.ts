
import { ValueType, Localization } from 'treb-base-types';
import { RDateScale } from './format';

/**
 * this is code that was in the old number format class, which was superceded
 * by the new treb-format module. we still need to do rough value parsing,
 * which is separate from parsing and from formatting.
 *
 * cleaning up to remove redundant bits, move inference in here
 * 
 * FIXME: move this somewhere else, this is the format library
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

  value: number|string|boolean|undefined;
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
  public TryParse(text = ''): ParseResult {

    let hints: Hints = Hints.None;

    // starts with SINGLE quote mark. express string.
    if (text[0] === '\'') return { value: text, type: ValueType.string };

    // empty string, treat as string (should be === 0 though?)
    if (text === '') return { value: text, type: ValueType.string };

    // we test if the conversion returns NaN, which usually means
    // it's not a number -- unless the string is actually NaN, which
    // is something we want to preserve.
    if ( text === 'NaN' ) return { value: NaN, type: ValueType.number, hints: Hints.Nan };

    let x = text.trim();
    // x = x.replace(/^[\$£€]/, '').trim();

    const currency = x.match(/^[$](.*?)$/);
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
      const lc = text.toLowerCase();
      if (lc === 'false') return { value: false, type: ValueType.boolean };
      if (lc === 'true' ) return { value: true, type: ValueType.boolean };

      // check date, but bound on reasonable years...
      // also maybe parameterize, make this optional

      const date = Date.parse(text);

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

      return { value: text, type: ValueType.string };
    }

    if (parens) { num = -num; }
    if (pct) {

      // NOTE: this is an attempt to reduce fp errors that arise
      // if you /100 (or if you /10 twice, which actually helps, but
      // is not sufficient). there's probably a better way to do this...

      const sign = num < 0 ? -1 : 1;
      const split = (sign * num).toString().split('.');

      split[0] = ('00' + split[0]).replace(/(\d\d)$/, '.$1');
      num = Number(split.join('')) * sign;
      
    }

    if (/e/.test(text)) hints |= Hints.Exponential;
    return { value: num, type: ValueType.number, hints };

  }

}

export const ValueParser = new ValueParserType();
