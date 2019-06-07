
import { NumberFormat } from './format';

/**
 * since users almost always make caches, we might as well
 * support a universal cache. also universal base (named) types.
 *
 * note that for this reason, you shouldn't mutate number formats.
 * mutate copies instead.
 */
export class NumberFormatCache {

  public static Get(format: string) {
    let formatter = this.cache[format];
    if (!formatter) {
      formatter = new NumberFormat(format);
      this.cache[format] = formatter;
    }
    return formatter;
  }

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
    const formatter = this.cache[format];
    if (formatter) { return formatter.toString(); }
    return format;
  }

  /**
   * check if the format matches a local symbolic name
   * and if so, return that.
   */
  public static SymbolicName(format: string): string|null {
    for (const key of Object.keys(this.base_formats)){
      if (format === this.base_formats[key]) return key;
    }
    return null;
  }

  private static cache: {[index: string]: NumberFormat} = {};

  private static base_formats: {[index: string]: string} = {
    accounting: '_(#,##0.00_);(#,##0.00);-???',
    number: '0.00',
    integer: '0',
    percent: '0.00%',
    general: '0.00###',
    dollar: '$* _(#,##0.00_);$* (#,##0.00);$* -???',
    exponential: '0.000e',

    'short date': 'mm/dd/yy',
    'long date': 'dddd, mmm d yyyy',
    timestamp: 'mm-dd-yy hh:mm:ss',
  };

  private static InitCache(){

    for (const key of Object.keys(this.base_formats)) {
      this.cache[key] = new NumberFormat(this.base_formats[key]);
    }

    const aliases: {[index: string]: string} = {
      scientific: 'exponential',
      percentage: 'percent',
      currency: 'dollar',
    };

    for (const key of Object.keys(aliases)) {
      this.cache[key] = this.cache[aliases[key]];
    }

  }

}

// is there a pattern for this? or a preferred way? I'm actually
// concerned that an optimizer might remove the method.

(NumberFormatCache as any).InitCache();

(self as any).NFC = NumberFormatCache;