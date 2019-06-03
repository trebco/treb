
// import * as LocaleCurrency from 'locale-currency';

export class Localization {

  public static decimal_separator: ('.' | ',') = '.';
  public static locale = 'en-us'; // default, for node
  // public static currency = '';

  /* * read-only argument separator, based on decimal separator * /
  public static get argument_separator() {
    return this.decimal_separator === ',' ? ';' : ',';
  }

  / ** read-only grouping separator, based on decimal separator * /
  public static get grouping_separator() {
    return this.decimal_separator === ',' ? ' ' : ',';
  }
  */

  public static argument_separator: ','|';' = ',';
  public static grouping_separator: ','|' ' = ',';

  public static UpdateLocale(locale?: string) {

    // priority:

    // (1) function argument
    // (2) get parameter
    // (3) navigator.languages[0]
    // (4) navigator.language

    // regarding languages[0] vs language, see
    // https://stackoverflow.com/a/33204290

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
    // this.currency = LocaleCurrency.getCurrency(this.locale || 'en-us') || 'USD';

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
// (self as any).LX = Localization;
