
import { FormatParser } from './format_parser';
import { NumberFormatSection } from './number_format_section';
import { Localization, TextPartFlag, TextPart } from 'treb-base-types';

/**
 * difference between an R date and a javascript date.
 * they both use the unix epoch.
 */
export const RDateScale = 86400000; // (1000 * 60 * 60 * 24);

/**
 * unifying date format and number format (really just bolting dates
 * on the side). dates have only a single section, constant pattern, and
 * are immutable.
 */
export class NumberFormat {

  public static grouping_regexp = /\d{1,3}(?=(\d{3})+(?!\d))/g;

//  NumberFormat.decimal_mark = Localization.decimal_separator;
//  if (NumberFormat.decimal_mark === ',') NumberFormat.grouping_separator = ' ';

//  public static decimal_mark: '.'|',' = Localization.decimal_separator;
//  public static grouping_separator = (Localization.decimal_separator === '.') ? ',' : ' ';

  public get pattern() {
    return this._pattern;
  }

  /** flag indicates if this is a date format */
  public get date_format() {
    return this.sections[0] && this.sections[0].date_format;
  }

  // tslint:disable-next-line:variable-name
  protected _pattern = '';
  protected sections: NumberFormatSection[];
  protected decimal_zero_regexp: Array<RegExp|undefined> = [];

  // this is a flag for string representation
  protected cloned: boolean[] = [];

  constructor(pattern: string){
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
      this.sections[1].prefix.push({text: '-'}); // at end of prefix, before number
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
          this.sections[3] = {...this.sections[0]};
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

  /** mutate */
  public IncreaseDecimal() {
    this.sections.forEach((section) => {
      section.decimal_min_digits++;
      section.decimal_max_digits = section.decimal_min_digits;
    });
  }

  /** mutate */
  public DecreaseDecimal() {
    this.sections.forEach((section) => {
      section.decimal_min_digits = Math.max(0, section.decimal_min_digits - 1);
      section.decimal_max_digits = section.decimal_min_digits;
    });
  }

  /** mutate */
  public AddGrouping() {
    this.sections.forEach((section) => {
      section.grouping = true;
    });
  }

  /** mutate */
  public RemoveGrouping() {
    this.sections.forEach((section) => {
      section.grouping = false;
    });
  }

  /** mutate */
  public ToggleGrouping() {
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
  public toString() {

    if (this.sections[0].date_format) {
      return this._pattern; // immutable
    }

    return this.sections.filter((section, i) => {
      return !this.cloned[i];
    }).map((section) => {

      let nf = '';
      let i = 0;

      if (section.has_number_format) {
        for (i = 0; i < section.integer_min_digits; i++) {
          nf += '0';
        }
        if (section.grouping){
          if (nf.length < 4) nf = ('####' + nf).slice(-4);
          nf = nf.replace(/[\d#]{1,3}(?=([\d#]{3})+(?![\d#]))/g, '$&' + Localization.grouping_separator);
        }
        if (section.decimal_max_digits || section.decimal_min_digits){
          nf += Localization.decimal_separator;
          for (i = 0; i < section.decimal_min_digits; i++) { nf += '0'; }
          for (; i < section.decimal_max_digits; i++) { nf += '#'; }
        }
        if (section.scaling){
          const count = Math.log10(section.scaling) / 3;
          for (i = 0; i < count; i++) { nf += ','; }
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
      }).join('') ;

    }).join(';');

  }

  /**
   * this method composes the format as a set of parts with various
   * states. it's intended for graphical representation where things
   * like hidden characters and padding require multiple passes or measurement.
   */
  public FormatParts(value: any){

    // new, shortcut
    if (typeof value !== 'number' && !this.sections[3]) {
      return [{ text: value.toString() }] as TextPart[]; // unreachable because we ensure 4 sections
    }

    const { parts, section } = this.BaseFormat(value);
    let text_parts: TextPart[] = [];

    if (section.date_format || section.string_format) {
      for (const part of parts) {
        if (typeof part === 'string') text_parts.push({text: part});
        else text_parts.push(part);
      }
    }
    else {
      text_parts = [
        ...(section.prefix.map((text_part) => {
          return {...text_part};
        })),
        {text: section.has_number_format ? parts.join(Localization.decimal_separator) : ''},
        ...(section.suffix.map((text_part) => {
          return {...text_part};
        })),
      ];
    }

    for (let i = 1; i < text_parts.length; i++){
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
  public Format(value: any, text_width = 0){

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
  }

  public ZeroPad(text: string, length: number) {
    while (text.length < length) text = '0' + text;
    return text;
  }

  public DateFormat(value: number) {

    const date = new Date(Math.max(0, value) * RDateScale);
    const section = this.sections[0];

    let hours = date.getHours();
    if (section.twelve_hour) {
      if (hours > 12) hours -= 12;
      if (hours === 0) hours = 12;
    }

    const parts: TextPart[] = section.prefix.map((part) => {
      if (part.flag === TextPartFlag.date_component_minutes) {
        if (part.text === 'mm') {
          return { text: this.ZeroPad((date.getMinutes()).toString(), 2) };
        }
        return { text: this.ZeroPad((date.getMinutes()).toString(), 1) };
      }
      else if (part.flag === TextPartFlag.date_component) {
        switch (part.text.toLowerCase()) {
        case 'am/pm':
        case 'a/p':
          const elements = part.text.split('/');
          return {text: date.getHours() > 12 ? elements[1] : elements[0]};

        case 'mmmmm':
          return { text: Localization.date_components.long_months[date.getMonth()][0] };
        case 'mmmm':
          if (part.text === 'MMMM') {
            return { text: Localization.date_components.long_months[date.getMonth()].toUpperCase() };
          }
          return { text: Localization.date_components.long_months[date.getMonth()] };
        case 'mmm':
          if (part.text === 'MMM') {
            return { text: Localization.date_components.short_months[date.getMonth()].toUpperCase() };
          }
          return { text: Localization.date_components.short_months[date.getMonth()] };
        case 'mm':
          return { text: this.ZeroPad((date.getMonth() + 1).toString(), 2) };
        case 'm':
          return { text: this.ZeroPad((date.getMonth() + 1).toString(), 1) };

        case 'ddddd':
        case 'dddd':
          if (part.text === 'DDDDD' || part.text === 'DDDD') {
            return { text: Localization.date_components.long_days[date.getDay()].toUpperCase() };
          }
          return { text: Localization.date_components.long_days[date.getDay()] };
        case 'ddd':
          if (part.text === 'DDD') {
            return { text: Localization.date_components.short_days[date.getDay()].toUpperCase() };
          }
          return { text: Localization.date_components.short_days[date.getDay()] };
        case 'dd':
          return { text: this.ZeroPad((date.getDate()).toString(), 2) };
        case 'd':
          return { text: this.ZeroPad((date.getDate()).toString(), 1) };

        case 'yyyy':
        case 'yyy':
          return { text: date.getFullYear().toString() };
        case 'yy':
        case 'y':
          return { text: (date.getFullYear() % 100).toString() };

        case 'hh':
          return { text: this.ZeroPad(hours.toString(), 2) };
        case 'h':
          return { text: this.ZeroPad(hours.toString(), 1) };

        case 'ss':
          return { text: this.ZeroPad((date.getSeconds()).toString(), 2) };
        case 's':
          return { text: this.ZeroPad((date.getSeconds()).toString(), 1) };

        }

        const match = part.text.match(/^(s+)\.(0+)$/);
        if (match) {
          return {
            text: this.ZeroPad(date.getSeconds().toString(), match[1].length) +
              Localization.decimal_separator +
              (date.getMilliseconds() / 1000).toFixed(match[2].length).substr(2),
          };
        }

      }
      return {...part}; // text: part.text, state: part.state};
    });

    return { parts, section };
  }

  public StringFormat(value: string, section: NumberFormatSection) {
    const parts: TextPart[] = [];
    for (const part of section.prefix) {
      if (part.flag === TextPartFlag.literal) {
        parts.push({text: value});
      }
      else parts.push({...part});
    }
    return {
      parts, section,
    };
  }

  public BaseFormat(value: any){

    if (this.sections[0].date_format) {
      return this.DateFormat(Number(value));
    }

    if (typeof value !== 'number') {
      return this.StringFormat(value.toString(), this.sections[3]);
    }

    let section = this.sections[0];
    let zero_regexp = this.decimal_zero_regexp[0];

    if (value < 0) {
      section = this.sections[1];
    }

    const epsilon = Math.pow(10, -section.decimal_max_digits) / 2;
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

    if (section.exponential) {
      representation = abs_value.toExponential(section.decimal_max_digits);
    }
    else {
      if (section.percent) {
        abs_value *= 100;
      }
      representation = abs_value.toFixed(section.decimal_max_digits);
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
