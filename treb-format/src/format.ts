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

/* eslint-disable no-irregular-whitespace */

import { FormatParser } from './format_parser';
import { NumberFormatSection } from './number_format_section';
import type { TextPart, Complex, DimensionedQuantity, CellValue} from 'treb-base-types';
import { 
    Localization, TextPartFlag, IsDimensionedQuantity,
  } from 'treb-base-types';

//
// excel time is explicitly universal, so we need all dates in and out 
// to be UTC. we can't use local time because of daylight savings (which
// excel ignores)
// 
// the actual epoch is "January 0" -- I suppose that === Dec 31?
//
// const base_date = -2209075200000; // new Date('1899-12-31 00:00:00 Z').getTime();

//
// excel time is 1 == 1 day, so relative to js time (millis), we need 
// to scale by 1000 * 60 * 60 * 24
//
// const date_scale = 86400000;

//
// one last thing -- Excel incorrectly treats 1900 as a leap year. this was
// for compatibility with Lotus 1-2-3, which handled it incorrectly. we will 
// join the party and treat it incorrectly as well.
// 
// ref:
// https://docs.microsoft.com/en-us/office/troubleshoot/excel/wrongly-assumes-1900-is-leap-year
//
// what about backwards?
//
// OK, I can answer that now: Excel just doesn't handle dates before 1900
// at all. can't parse them; can't handle negative numbers as dates. 

/** convert cell value -> date, using the rules above */
export const LotusDate = (value: number): Date => {
  if (value >= 60) value--; // March 1, 1900
  return new Date(-2209075200000 + 86400000 * value);
};

/** convert date (as number, utc millis) -> lotus date value */
export const UnlotusDate = (value: number, local = true): number => {

  // if the passed value is local, we need to convert it to UTC

  if (local) {

    const local_date = new Date(value);
    const utc_date = new Date(
      local_date.getFullYear(),
      local_date.getMonth(),
      local_date.getDate(),
      local_date.getHours(),
      local_date.getMinutes(),
      local_date.getSeconds(),
      local_date.getMilliseconds(),
    );

    // console.info("Converting local", utc_date.toUTCString());

    value = utc_date.getTime();

  }

  value = (value + 2209075200000) / 86400000;
  if (value >= 60) { value++; }

  return value;

};

/**
 * unifying date format and number format (really just bolting dates
 * on the side). dates have only a single section, constant pattern, and
 * are immutable.
 */
export class NumberFormat {

  public static grouping_regexp = /\d{1,3}(?=(\d{3})+(?!\d))/g;

  public static fraction_limits = [9, 99, 999, 9999];

  /**
   * this is now exposed so it can be changed, for rendering; some options are 
   * 
   * "i" - regular i, and the default
   * "𝑖" - mathematical italic small i", U+1D456
   * " 𝑖" - the same, with a leading hair space (U+200A)
   */
  public static imaginary_character = '𝑖'; //  'i';

  /**
   * also for complex rendering, the minus sign. there's a unicode 
   * symbol U+2212 which (at least in calibri) is wider than the regular minus 
   * sign/hyphen. I like this but it looks a bit odd if negative numbers are 
   * rendered using the other one.
   * 
   * "-" - hyphen
   * "−" - minus
   */
  public static minus_character = '-'; // hyphen
  // public static minus_character = '−'; // minus

  /** for the "General" format, a magic decimal point */
  public magic_decimal = false;

  /**
   * (testing) transformer. this is not rendered or persisted, like magic
   * decimal it needs to be applied in code. ATM this is only applied in
   * formatting DQ, but it might turn out to be more universal...
   * 
   * NOTE that atm this transforms value back into the same type; we don't
   * cross types (at least for now). perhaps we should support that? that
   * might mean switching in here and removing the "special" format calls
   * for complex and DQ.
   */
  public transform_value?: (value: CellValue) => CellValue;

  // tslint:disable-next-line:variable-name
  protected _pattern = '';
  protected sections: NumberFormatSection[];
  protected decimal_zero_regexp: Array<RegExp | undefined> = [];

  // this is a flag for string representation
  protected cloned: boolean[] = [];

  //  NumberFormat.decimal_mark = Localization.decimal_separator;
  //  if (NumberFormat.decimal_mark === ',') NumberFormat.grouping_separator = ' ';

  //  public static decimal_mark: '.'|',' = Localization.decimal_separator;
  //  public static grouping_separator = (Localization.decimal_separator === '.') ? ',' : ' ';

  public get pattern(): string {
    return this._pattern;
  }

  /** flag indicates if this is a date format */
  public get date_format(): boolean {
    return this.sections[0] && this.sections[0].date_format;
  }

  constructor(pattern: string) {
    this._pattern = pattern;
    this.sections = FormatParser.Parse(pattern);

    // nothing?

    if (!this.sections.length) this.sections = [];

    // check zero. we were previously assuming this stepped, but we
    // now support gaps in format sections (although not at 0?)

    if (!this.sections[0]) {
      this.sections[0] = new NumberFormatSection(); // pretty sure this cannot happen atm
    }

    // do we have a negative section? if not, use the positive
    // section and prepend a - sign.

    if (!this.sections[1]) {
      this.sections[1] = { ...this.sections[0] };
      this.sections[1].prefix = JSON.parse(JSON.stringify(this.sections[1].prefix));
      this.sections[1].suffix = JSON.parse(JSON.stringify(this.sections[1].suffix));
      this.sections[1].prefix.push({ text: '-' }); // at end of prefix, before number
      this.cloned[1] = true;
    }

    // do we have a zero section? if not, clone the positive section.

    if (!this.sections[2]) {
      this.sections[2] = { ...this.sections[0] };
      this.cloned[2] = true;
    }

    // string section, default just reflects the string. we could perhaps
    // skip this and just have default behavior if there's no section, which
    // might simplify rendering

    // UPDATE, special case: unless a string section is explicitly
    // provided, we use a default '@' section (it's implicit). however,
    // if there's a literatal '@' in the first section, we want to
    // propogate that to all empty sections, including the string section.

    // note that we should not support literal AND numeric sections in
    // the same block... it will fail silently here... [FIXME: at least warn]

    if (!this.sections[3]) {
      for (const part of this.sections[0].prefix) {
        if (part.flag === TextPartFlag.literal) {
          this.sections[3] = { ...this.sections[0] };
          this.sections[3].string_format = true;
          this.cloned[3] = true;
          break;
        }
      }
    }

    /*
    if (!this.sections[3]) {
      this.sections[3] = new NumberFormatSection();
      this.sections[3].string_format = true;
      this.sections[3].prefix = [{ text: '@', flag: TextPartFlag.literal }];

      // obviously not cloned, but we want the behavior. FIXME: change flag name
      this.cloned[3] = true;
    }
    */

    this.decimal_zero_regexp = this.sections.map((section) => {
      if (section.decimal_max_digits > section.decimal_min_digits) {
        return new RegExp(`0{1,${section.decimal_max_digits - section.decimal_min_digits}}(?:$|e)`);
      }
      return undefined;
    });

  }

  /**
   * render text parts to string
   * FIXME: move
   */
  public static FormatPartsAsText(parts: TextPart[], text_width = 0): string {

    let padded = -1;

    const formatted = parts.map((part, index) => {
      switch (part.flag) {
        case TextPartFlag.padded:
          padded = index;
          return part.text;

        case TextPartFlag.hidden:
          return part.text.replace(/./g, ' ');

        case TextPartFlag.formatting:
          return '';

        default:
          return part.text;
      }
    });

    if (padded >= 0 && text_width) {
      const total_length = formatted.reduce((a, str, index) => (index === padded) ? a : a + str.length, 0);
      let tmp = '';
      for (let i = 0; i < text_width - total_length; i++) {
        tmp += formatted[padded];
      }
      formatted[padded] = tmp;
    }

    return formatted.join('');

  }

  /** for decimal only, set an explicit number of digits */
  public SetDecimal(digits: number): void {
    for (const section of this.sections) {
      if (!section.fraction_format) {
        section.decimal_min_digits = digits;
        section.decimal_max_digits = digits;
      }
    }
  }

  /** 
   * mutate 
   * UPDATE: for fractional formats, increase the denominator digits
   *         (doing something weird with fixed denominators...)
   */
  public IncreaseDecimal(): void {
    this.sections.forEach((section) => {
      if (section.fraction_format) {
        if (!section.fraction_denominator) {
          section.fraction_denominator_digits = Math.min(section.fraction_denominator_digits + 1, 4);
        }
      }
      else {
        section.decimal_min_digits++;
        section.decimal_max_digits = section.decimal_min_digits;
      }
    });
  }

  /** 
   * mutate 
   * UPDATE: for fractional formats, decrease the denominator digits
   *         (doing something weird with fixed denominators...)
   */
  public DecreaseDecimal(): void {
    this.sections.forEach((section) => {
      if (section.fraction_format) {
        if (!section.fraction_denominator) {
          section.fraction_denominator_digits = Math.max(section.fraction_denominator_digits - 1, 1);
        }
      }
      else {
        section.decimal_min_digits = Math.max(0, section.decimal_min_digits - 1);
        section.decimal_max_digits = section.decimal_min_digits;
      }
    });
  }

  /** mutate */
  public AddGrouping(): void {
    this.sections.forEach((section) => {
      section.grouping = true;
    });
  }

  /** mutate */
  public RemoveGrouping(): void {
    this.sections.forEach((section) => {
      section.grouping = false;
    });
  }

  /** mutate */
  public ToggleGrouping(): void {
    // set all to ! the value of the first one 
    const grouping = !this.sections[0].grouping;
    this.sections.forEach((section) => {
      section.grouping = grouping;
    });
  }

  /**
   * generates a string representation. we use this because we are (now)
   * allowing mutation of formats; therefore we need to serialize them back
   * to the basic format.
   */
  public toString(): string {

    if (this.sections[0].date_format) {
      return this._pattern; // immutable
    }

    return this.sections.filter((section, i) => {
      return !this.cloned[i];
    }).map((section) => {

      let nf = '';
      let i = 0;

      if (section.fraction_format) {
        if (section.fraction_integer) {
          nf += '? ';
        }
        let pattern = '';
        for (let j = 0; j < section.fraction_denominator_digits; j++) {
          pattern += '#';
        }
        nf += pattern;
        nf += '/';
        if (section.fraction_denominator) {
          nf += section.fraction_denominator;
        }
        else {
          nf += pattern;
        }
      }
      else if (section.has_number_format) {
        for (i = 0; i < section.integer_min_digits; i++) {
          nf += '0';
        }
        if (section.grouping) {
          if (nf.length < 4) nf = ('####' + nf).slice(-4);
          nf = nf.replace(/[\d#]{1,3}(?=([\d#]{3})+(?![\d#]))/g, '$&' + ','); // Localization.grouping_separator);
        }
        if (section.decimal_max_digits || section.decimal_min_digits) {
          nf += '.'; // Localization.decimal_separator;
          for (i = 0; i < section.decimal_min_digits; i++) { nf += '0'; }
          for (; i < section.decimal_max_digits; i++) { nf += '#'; }
        }
        if (section.scaling) {
          const count = Math.log10(section.scaling) / 3;
          for (i = 0; i < count; i++) { nf += ','; }
        }
        if (section.exponential) {
          nf += 'e';
        }
      }

      return section.prefix.map((part) => {
        if (part.flag === TextPartFlag.hidden) {
          return part.text === '0' ? '?' : '_' + part.text;
        }
        else if (part.flag === TextPartFlag.padded) {
          return '*' + part.text;
        }
        else if (part.flag === TextPartFlag.formatting) {
          return '[' + part.text + ']';
        }
        return part.text;
      }).join('') + nf +
        section.suffix.map((part) => {
          if (part.flag === TextPartFlag.hidden) {
            return part.text === '0' ? '?' : '_' + part.text;
          }
          else if (part.flag === TextPartFlag.padded) { return '*' + part.text; }
          return part.text;
        }).join('');

    }).join(';');

  }

  /** also temporary? why not switch in here? */
  public FormatDimensionedQuantity(value: DimensionedQuantity): TextPart[]|string {

    if (this.transform_value) {
      const result = this.transform_value(value);
      if (IsDimensionedQuantity(result)) {
        value = result;
      }
      else if (typeof result === 'string') {

        // so this is new, but we want string semantics here; rendering
        // is different because strings can wrap

        return result;
      }
      else {

        // could be a complex (not likely now, but things change), in which
        // case this is not the right method -- we need a method that checks
        // and switches.

        return this.FormatParts(result);
      }
    }

    const parts: TextPart[] = this.FormatParts(value.value || 0);

    // anything fancy we want to do in here...

    if (value.unit) {
      parts.push({text: ' '}, {
        text: value.unit
      });
    }

    return parts;
  }

  /** 
   * temporary 
   * 
   * FIXME: merge with FormatParts, use a test to check if it's complex?
   * OTOH that adds a test to every format which is probably wasteful...
   * although we can check for 'number' first
   * 
   */
  public FormatComplex(value: Complex): TextPart[] {

    // formatting complex value (note for searching)

    // this needs some work. some thoughts:
    //
    // (1) allow fractions and decimals, but not percent or exponential notation
    // (2) change default for General to have fewer decimal places
    // (3) use the section's integer specification to decide on whether to
    //     write "1i" or just "i"
    // (4) drop either real or imaginary part (but not both) if it renders as 
    //     all zeros
    // (5) change default fraction to #/## (actually we should do that always)

    if (value.imaginary === Infinity || value.imaginary === -Infinity || 
        value.real === Infinity || value.real === -Infinity) {
      return [
        {
          text: 'Infinity',
        }
      ]
    }

    // check if the imaginary format will render as 0.00i -- we want to 
    // handle this differently.

    let imaginary_format: TextPart[] = [];
    let real_format: TextPart[] = [];

    let drop_imaginary_coefficient = false;

    let has_imaginary_value = !!value.imaginary;
    if (has_imaginary_value) {
      imaginary_format = this.FormatParts(value.imaginary);
      has_imaginary_value = imaginary_format.some(element => /[1-9]/.test(element.text));
      
      // special case: if the integer is not required and the value is
      // either "1" or "-1", drop the integer. do this for integer length
      // <= 1, because you want 0, i, 2i, 3i, &c. 

      if (imaginary_format.length === 1 &&
          this.sections[0].integer_min_digits <= 1 && 
          imaginary_format[0].text === '1' ) {
        imaginary_format[0].text = '';
        drop_imaginary_coefficient = true;
      }
      else if (imaginary_format.length === 1 &&
               this.sections[1].integer_min_digits <= 1 && 
               imaginary_format[0].text === '-1' ) {
        imaginary_format[0].text = '-';
        drop_imaginary_coefficient = true;
      }

    }

    let has_real_value = !!value.real;
    if (has_real_value) {
      real_format = this.FormatParts(value.real);
      has_real_value = real_format.some(element => /[1-9]/.test(element.text));
    }

    const parts: TextPart[] = [];

    if (has_real_value || (!has_real_value && !has_imaginary_value)) {

      // has real part, or is === 0 
      parts.push(...real_format);

      if (has_imaginary_value) {

        // also has imaginary part
        // const i = Math.abs(value.imaginary);
        parts.push({ text: value.imaginary < 0 ? ` ${NumberFormat.minus_character} ` : ' + ' });

        const reformatted_imaginary = drop_imaginary_coefficient ?
          [] : this.FormatParts(Math.abs(value.imaginary));

        parts.push(...reformatted_imaginary, { text: NumberFormat.imaginary_character });

      }
    }
    else if (has_imaginary_value) {

      // only imaginary part
      parts.push(...imaginary_format, { text: NumberFormat.imaginary_character });

    }

    return parts;
  }

  /**
   * this method composes the format as a set of parts with various
   * states. it's intended for graphical representation where things
   * like hidden characters and padding require multiple passes or measurement.
   */
  public FormatParts(value: CellValue): TextPart[] {

    // new, shortcut
    if (typeof value !== 'number' && !this.sections[3]) {

      // NOTE: that note (next line) seems to be incorrect, not sure why
      // ofc if that was true there'd be no point to this block...

      return [{ text: (value??'').toString() }] as TextPart[]; // unreachable because we ensure 4 sections
    }

    const { parts, section } = this.BaseFormat(value);
    let text_parts: TextPart[] = [];

    if (section.date_format || section.string_format) {
      for (const part of parts) {
        if (typeof part === 'string') {
          text_parts.push({ text: part });
        }
        else text_parts.push(part);
      }
    }
    else {

      // magic 

      if (this.magic_decimal && parts[1] === '') {
        parts.splice(1, 1);
      }

      text_parts = [
        ...(section.prefix.map((text_part) => {
          return { ...text_part };
        })),
        { text: section.has_number_format ? parts.join(Localization.decimal_separator) : '' },
        ...(section.suffix.map((text_part) => {
          return { ...text_part };
        })),
      ];
    }

    for (let i = 1; i < text_parts.length; i++) {
      if (text_parts[i].flag === text_parts[i - 1].flag) {
        text_parts[i].text = text_parts[i - 1].text + text_parts[i].text;
        text_parts[i - 1].text = '';
      }
    }

    return text_parts.filter((text_part) => text_part.text); // remove empty
  }

  /**
   * formats a number as text.
   *
   * this method will use a single space to replace hidden (leading-underscore)
   * characters. if a text width is provided, it will use that for padding;
   * otherwise the padding character (we only allow a single padding character)
   * is rendered once.
   *
   * FIXME: date, string (this is lagging)
   * UPDATE: unifying, basing this on the text part functionality
   */
  public Format(value: CellValue, text_width = 0): string {

    /*
    const parts = this.FormatParts(value);
    let padded = -1;

    const formatted = parts.map((part, index) => {
      switch (part.flag) {
        case TextPartFlag.padded:
          padded = index;
          return part.text;

        case TextPartFlag.hidden:
          return part.text.replace(/./g, ' ');

        case TextPartFlag.formatting:
          return '';

        default:
          return part.text;
      }
    });

    if (padded >= 0 && text_width) {
      const total_length = formatted.reduce((a, str, index) => (index === padded) ? a : a + str.length, 0);
      let tmp = '';
      for (let i = 0; i < text_width - total_length; i++){
        tmp += formatted[padded];
      }
      formatted[padded] = tmp;
    }

    return formatted.join('');
    */

    return NumberFormat.FormatPartsAsText(this.FormatParts(value), text_width);

  }

  public ZeroPad(text: string, length: number): string {
    while (text.length < length) text = '0' + text;
    return text;
  }

  public DateFormat(value: number) {

    const date = LotusDate(value);
    const section = this.sections[0];

    let hours = date.getUTCHours();
    if (section.twelve_hour) {
      if (hours > 12) hours -= 12;
      if (hours === 0) hours = 12;
    }

    const parts: TextPart[] = section.prefix.map((part) => {
      if (part.flag === TextPartFlag.date_component_minutes) {
        if (part.text === 'mm') {
          return { text: this.ZeroPad((date.getUTCMinutes()).toString(), 2) };
        }
        return { text: this.ZeroPad((date.getUTCMinutes()).toString(), 1) };
      }
      else if (part.flag === TextPartFlag.date_component) {
        switch (part.text.toLowerCase()) {
          case 'am/pm':
          case 'a/p':
            {
              const elements = part.text.split('/');
              return { text: date.getUTCHours() > 12 ? elements[1] : elements[0] };
            }
          case 'mmmmm':
            return { text: Localization.date_components.long_months[date.getUTCMonth()][0] };
          case 'mmmm':
            if (part.text === 'MMMM') {
              return { text: Localization.date_components.long_months[date.getUTCMonth()].toUpperCase() };
            }
            return { text: Localization.date_components.long_months[date.getUTCMonth()] };
          case 'mmm':
            if (part.text === 'MMM') {
              return { text: Localization.date_components.short_months[date.getUTCMonth()].toUpperCase() };
            }
            return { text: Localization.date_components.short_months[date.getUTCMonth()] };
          case 'mm':
            return { text: this.ZeroPad((date.getUTCMonth() + 1).toString(), 2) };
          case 'm':
            return { text: this.ZeroPad((date.getUTCMonth() + 1).toString(), 1) };

          case 'ddddd':
          case 'dddd':
            if (part.text === 'DDDDD' || part.text === 'DDDD') {
              return { text: Localization.date_components.long_days[date.getUTCDay()].toUpperCase() };
            }
            return { text: Localization.date_components.long_days[date.getUTCDay()] };
          case 'ddd':
            if (part.text === 'DDD') {
              return { text: Localization.date_components.short_days[date.getUTCDay()].toUpperCase() };
            }
            return { text: Localization.date_components.short_days[date.getUTCDay()] };
          case 'dd':
            return { text: this.ZeroPad((date.getUTCDate()).toString(), 2) };
          case 'd':
            return { text: this.ZeroPad((date.getUTCDate()).toString(), 1) };

          case 'yyyy':
          case 'yyy':
            return { text: date.getUTCFullYear().toString() };
          case 'yy':
          case 'y':
            // return { text: (date.getUTCFullYear() % 100).toString() };
            return { text: this.ZeroPad((date.getUTCFullYear() % 100).toString(), 2) };

          case 'hh':
            return { text: this.ZeroPad(hours.toString(), 2) };
          case 'h':
            return { text: this.ZeroPad(hours.toString(), 1) };

          case 'ss':
            return { text: this.ZeroPad((date.getUTCSeconds()).toString(), 2) };
          case 's':
            return { text: this.ZeroPad((date.getUTCSeconds()).toString(), 1) };

        }

        const match = part.text.match(/^(s+)\.(0+)$/);
        if (match) {
          return {
            text: this.ZeroPad(date.getUTCSeconds().toString(), match[1].length) +
              Localization.decimal_separator +
              (date.getUTCMilliseconds() / 1000).toFixed(match[2].length).substr(2),
          };
        }

      }
      return { ...part }; // text: part.text, state: part.state};
    });

    return { parts, section };
  }

  public StringFormat(value: string, section: NumberFormatSection) {
    const parts: TextPart[] = [];
    for (const part of section.prefix) {
      if (part.flag === TextPartFlag.literal) {
        parts.push({ text: value });
      }
      else parts.push({ ...part });
    }
    return {
      parts, section,
    };
  }

  /*
  public DecimalAdjustRound(value: number, exp: number) {

    if (!exp) { return Math.round(value); }

    value = +value;
    // exp = +exp;

    // Shift
    let values = value.toString().split('e');
    value = Math.round(+(values[0] + 'e' + (values[1] ? (+values[1] - exp) : -exp)));

    // Shift back
    values = value.toString().split('e');
    return +(values[0] + 'e' + (values[1] ? (+values[1] + exp) : exp));

  }
  */

  public Round2(value: number, digits: number): number {
    const m = Math.pow(10, digits);
    return Math.round(m * value) / m;
  }

  public FormatFraction(value: number, section: NumberFormatSection): string {

    if (section.percent) {
      value *= 100;
    }

    let candidate = {
      denominator: 1,
      numerator: Math.round(value),
      error: Math.abs(Math.round(value) - value),
    };

    if (section.fraction_denominator) {
      candidate.denominator = section.fraction_denominator;
      candidate.numerator = Math.round(value * candidate.denominator);
    }
    else {

      if (candidate.error) {
        const limit = NumberFormat.fraction_limits[section.fraction_denominator_digits - 1] || NumberFormat.fraction_limits[0];
        for (let denominator = 2; denominator <= limit; denominator++) {
          const numerator = Math.round(value * denominator);
          const error = Math.abs(numerator / denominator - value);
          if (error < candidate.error) {
            candidate = {
              numerator, denominator, error,
            };
            if (!error) { break; }
          }
        }
      }

    }

    const text: string[] = [];

    if (section.fraction_integer) {
      const integer = Math.floor(candidate.numerator / candidate.denominator);
      candidate.numerator %= candidate.denominator;
      if (integer || !candidate.numerator) {
        text.push(integer.toString());
        if (candidate.numerator) {
          text.push(' ');
        }
      }
    }
    else if (!candidate.numerator) {
      text.push('0');
    }

    if (candidate.numerator) {
      text.push(candidate.numerator.toString());
      text.push('/');
      text.push(candidate.denominator.toString());
    }

    return text.join('');

  }

  public BaseFormat(value: CellValue) {

    if (this.sections[0].date_format) {
      return this.DateFormat(Number(value));
    }

    if (typeof value !== 'number') {
      return this.StringFormat((value??'').toString(), this.sections[3]);
    }

    let section = this.sections[0];
    let zero_regexp = this.decimal_zero_regexp[0];

    if (value < 0) {
      section = this.sections[1];
    }

    const max_digits = section.percent ?
      section.decimal_max_digits + 2 :
      section.decimal_max_digits;

    const epsilon = Math.pow(10, -max_digits) / 2;
    let abs_value = Math.abs(value);

    if (abs_value < epsilon) {
      section = this.sections[2];
      zero_regexp = this.decimal_zero_regexp[2];
    }

    // there's kind of a weird thing here where we might have
    // a non-zero number but scaling turns it into zero...

    if (section.scaling) {
      abs_value /= section.scaling;
      if (abs_value < epsilon) {
        section = this.sections[2];
        zero_regexp = this.decimal_zero_regexp[2];
      }
    }

    if (section.string_format) {
      return this.StringFormat(value.toString(), section);
    }

    let representation = '';

    // special handling for fractions skips most of the other bits
    if (section.fraction_format) {
      return { parts: [this.FormatFraction(abs_value, section)], section };
    }

    if (section.exponential) {
      representation = abs_value.toExponential(section.decimal_max_digits);
    }
    else {
      if (section.percent) {
        abs_value *= 100;
      }
      representation = this.Round2(abs_value, section.decimal_max_digits).toFixed(section.decimal_max_digits);
    }

    if (zero_regexp) {
      representation = representation.replace(zero_regexp, '');
    }

    const parts = representation.split('.');

    while (parts[0].length < section.integer_min_digits) {
      parts[0] = ('0000000000000000' + parts[0]).slice(-section.integer_min_digits);
    }

    if (section.integer_min_digits === 0 && parts[0] === '0') {
      parts[0] = ''; // not sure why anyone would want that
    }

    if (section.grouping) {
      parts[0] = parts[0].replace(NumberFormat.grouping_regexp, '$&' + Localization.grouping_separator);
    }

    return { parts, section };

  }

}
