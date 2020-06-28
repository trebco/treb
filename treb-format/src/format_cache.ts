
import { NumberFormat } from './format';

/**
 * since users almost always make caches, we might as well
 * support a universal cache. also universal base (named) types.
 *
 * note that for this reason, you shouldn't mutate number formats.
 * mutate copies instead.
 */
export class NumberFormatCache {

  /** cache instance */
  private static cache: {[index: string]: NumberFormat} = {};

  /** 
   * this map is for case-insensitive mapping symbolic names to formats. we
   * want symbolic names with casing, primarily for interop, but we also want
   * to support icase matching.
   * 
   * FIXME: is there a better way to do this, with a pattern or something in
   * the cache?
   */
  private static symbolc_name_map: {[index: string]: string} = {};

  /** base types, with default names */
  private static base_formats: {[index: string]: string} = {

    Accounting: '_(#,##0.00_);(#,##0.00);-???',
    Number: '0.00',
    Integer: '0',
    Percent: '0.00%',
    General: '0.00###',
    Dollar: '$* _(#,##0.00_);$* (#,##0.00);$* -???',
    Exponential: '0.000e',

    'Short Date': 'mm/dd/yy',
    'Long Date': 'dddd, mmm d yyyy',
    Timestamp: 'mm-dd-yy hh:mm:ss',

  };

  /** alias types */
  private static aliases: {[index: string]: string} = {

    Scientific: 'Exponential',
    Percentage: 'Percent',
    Currency: 'Dollar',

    /*
    // we switched to Uppercase symbolic names to better
    // match imported files, but we have legacy stuff using
    // lowercase, so add aliases.

    accounting: 'Accounting',
    number: 'Number',
    integer: 'Integer',
    percent: 'Percent',
    general: 'General',
    dollar: 'Dollar',
    exponential: 'Exponential',

    'short date': 'Short Date',
    'long date': 'Long Date',
    timestamp: 'Timestamp',
    */

  };

  public static Get(format: string) {

    // FIXME: we should use icase for symbolc formats, although not
    // for format strings. there should (hopefully) be no case where
    // these overlap.

    const canonical_name = this.symbolc_name_map[format.toLowerCase()];

    let formatter = this.cache[canonical_name || format];
    
    if (!formatter) {
      formatter = new NumberFormat(format);
      this.cache[format] = formatter;
    }
    return formatter;
  }

  /** 
   * does anyone use this? (...)
   */
  public static Equals(a: string, b: string) {
    if (a === b) return true;
    const fa = this.Get(a);
    const fb = this.Get(b);
    return fa.pattern === fb.pattern;
  }

  /**
   * this method is used to translate symbolic formats,
   * without actually creating a formatter. it's a shortcut
   * we need for exporting to xlsx.
   *
   * if the passed format matches a symbolic format, we return
   * the string representation. if it doesn't match any symbolic format,
   * the string is returned as-is.
   */
  public static Translate(format: string): string {

    const mapped = this.symbolc_name_map[format.toLowerCase()];
    return mapped ? this.cache[mapped].toString() : format;

    // const formatter = this.cache[format];
    // if (formatter) { return formatter.toString(); }
    // return format;
  }

  /**
   * check if the format (as a number format) matches a local 
   * symbolic name and if so, return that.
   */
  public static SymbolicName(format: string): string|null {
    for (const key of Object.keys(this.base_formats)){
      if (format === this.base_formats[key]) return key;
    }
    return null;
  }

  public static InitCache(){

    for (const key of Object.keys(this.base_formats)) {
      this.cache[key] = new NumberFormat(this.base_formats[key]);
      this.symbolc_name_map[key.toLowerCase()] = key;
    }

    for (const key of Object.keys(this.aliases)) {
      this.cache[key] = this.cache[this.aliases[key]];
      this.symbolc_name_map[key.toLowerCase()] = key;
    }

  }

}

// is there a pattern for this? or a preferred way? I'm actually
// concerned that an optimizer might remove the method.

NumberFormatCache.InitCache();
