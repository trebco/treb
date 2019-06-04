
/**
 * the point of localization is to have a central, single source of truth
 * for the current locale. this can come from the browser, via a GET
 * parameter (mostly for testing), or explicitly from a method call.
 *
 * based on locale we report settings for decimal separator, digit grouping,
 * and argument separator.
 */
export class Localization {

  public static locale = 'en-us'; // default, for node

  public static decimal_separator: ('.' | ',') = '.';
  public static argument_separator: ','|';' = ',';
  public static grouping_separator: ','|' ' = ',';

  /**
   * update the locale. this will be called on module load (should
   * be just once), but can be called subsequently to update.
   *
   * priority:
   * (1) function argument
   * (2) get parameter
   * (3) navigator.languages[0]
   * (4) navigator.language
   *
   * regarding languages[0] vs language, see
   * https://stackoverflow.com/a/33204290
   *
   * @param locale explicitly set locale
   */
  public static UpdateLocale(locale?: string) {

    if (locale) {
      this.locale = locale; // 1
    }
    else {

      const location = ((typeof self === 'undefined' || typeof self.document === 'undefined') ?
        undefined : self.document.location);

      if (location && location.search &&
          /locale=/.test(location.search)) {

        const match = location.search.match(/locale=(.*?)(?:\?|$)/);
        if (match) this.locale = match[1];
        console.info('override locale', this.locale);
      }
      else if (typeof navigator !== 'undefined') {
        if (navigator.languages && navigator.languages[0]) {
          this.locale = navigator.languages[0];
        }
        else {
          this.locale = navigator.language;
        }
      }
    }

    const decimal_separator = new Intl.NumberFormat(this.locale,
      {minimumFractionDigits: 1}).format(3.3).replace(/\d/g, '');

    this.decimal_separator = (decimal_separator === ',') ? ',' : '.';

    if (this.decimal_separator === ',') {
      this.argument_separator = ';';
      this.grouping_separator = ' ';
    }

  }

}

Localization.UpdateLocale(); // always call
