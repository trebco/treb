
import { ValueType, Localization } from 'treb-base-types';
import { UnlotusDate } from './format';

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

  public compare_day?: Record<string, number>;
  public compare_month?: Record<string, number>;

  public TestDate(text: string): number|false {

    // first check if JS can turn it into a date at all. we can
    // use that as a baseline/initial check (in any event there's
    // no point in doing the work otherwise)

    const date_value = Date.parse(text);
    if (isNaN(date_value)) {
      // console.info('td false: is nan')
      return false;
    }

    const date = new Date(date_value);

    // OK so there's a date, now we can do whatever validation we want

    // is there a regexp for accented characters? actually we can
    // maybe go backwards... remove things that properly belong in
    // dates: numbers, dashes and slashes (+ comma, whitespace)

    // dots are in some l10n systems... maybe we should check first?

    // Q: what does lowercase do for accented characters? (...)

    // NOTE: as it turns out, Date.parse() only handles US-EN. so
    // all this is unecessary (and unused) in other locales. to really
    // do this properly we will probably need to write our own locale-
    // aware date parser. which is probably a lot of work. TODO.

    const tmp = text.replace(/[\d\-\\/,.\s]+/g, ' ').toLocaleLowerCase();

    // then split into individual strings. trim and drop empty

    const components = tmp.split(/\s+/).map(component => component.trim()).filter(component => !!component);

    if (!components.length) {
      // console.info('td true: no strings');
      return date_value; // probably a date
    }

    // now we'll compare these to stuff we have in l10n. rule (WIP):
    // should be in month or day-of-week. accept short or long, or one 
    // character. (one character introduces some ambiguity...)

    // drop 1 character, it's ambiguous and annoying (also hard to handle)

    // so basically, any string in here has to be a month or day; we can't 
    // have two of either; they have to match what was parsed; and you can't
    // have a day-of-week but not a month.

    // FIXME: cache/precalc
    // let's do it lazily

    // NOTE: portugeuse seems to include periods in their abbreviations...

    if (!this.compare_month) {
      this.compare_month = {};
      for (let i = 0; i < 12; i++) {
        this.compare_month[Localization.date_components.long_months[i].toLocaleLowerCase().replace(/\./, '')] = i;
        this.compare_month[Localization.date_components.short_months[i].toLocaleLowerCase().replace(/\./, '')] = i;
        // comparison[Localization.date_components.long_months[i][0].toLocaleLowerCase()] = i;
      }
    }

    if (!this.compare_day) {
      this.compare_day = {};
      for (let i = 0; i < 7; i++) {
        this.compare_day[Localization.date_components.long_days[i].toLocaleLowerCase().replace(/\./, '')] = i;
        this.compare_day[Localization.date_components.short_days[i].toLocaleLowerCase().replace(/\./, '')] = i;
      }
    }

    let found_month = false;
    let found_day = false;

    for (const component of components) {
      let found = false;
      for (const [month, value] of Object.entries(this.compare_month)) {
        if (component === month) {
        
          // can't have two months in a single date
          if (found_month) {
            // console.info('td false: two months')
            return false;
          }

          // have a string match [FIXME: fuzzy?]
          // check that the month matches

          if (date.getUTCMonth() !== value) {
            // console.info('td false: month mismatch')
            return false;
          }

          found = true;
          found_month = true;

        }
      }
      if (!found) {
        for (const [day, value] of Object.entries(this.compare_day)) {
          if (component === day) {

            // can't have two days either
            if (found_day) {
              // console.info('td false: two days')
              return false;
            }

            if (date.getUTCDay() !== value) {
              // console.info('td false: day mismatch')
              return false;
            }
  
            found = true;
            found_day = true;
          }
        }
      }

      if (!found) {

        // whatever this string is, we don't recognize it. so this is 
        // probably not a date.

        // console.info('td false: unmatched string')
        return false;
      }
    }
    
    // last check: no DOW without month.

    if (found_day && !found_month) {
      // console.info('td false: day but no month')
      return false;
    }

    // OK, accept it

    // console.info('td true: ran out of cases')
    return date_value;

  }

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

      // this is too aggressive (at least in chrome). we need to dial it 
      // back a bit. to do that, we will validate any strings in the text
      // and ensure they look like date components (usually months and days),
      // within the current locale.    

      const date = this.TestDate(text);

      if (false !== date && !isNaN(date)) {

        // we can drop this bit, now (I think)

        const check = new Date(date);
        const year = check.getUTCFullYear();

        if (year >= (this_year - 200) && year <= (this_year + 200)) {
          hints = Hints.Date;

          if (check.getHours() || check.getMinutes() || check.getSeconds()) {
            hints |= Hints.Time;
          }

          return {
            value: UnlotusDate(date),
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
