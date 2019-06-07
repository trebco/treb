
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

  public static date_components = {
    short_days: [
      'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat',
    ],

    long_days: [
      'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
    ],

    short_months: [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ],

    long_months: [
      'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
      'September', 'October', 'November', 'December',
    ],
  };

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
          /locale=([^\?&]+?)(?:\?|$|&)/.test(location.search)) {
        const match = location.search.match(/locale=(.*?)(?:\?|$|&)/);
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

    // moved from number format lib


      let date = new Date(2000, 0, 2, 12, 0, 0, 0); // Sun Jan 2
      this.UpdateDateComponent(0, 0, date);

      date = new Date(2000, 1, 7, 12, 0, 0, 0); // Mon Feb 7
      this.UpdateDateComponent(1, 1, date);

      date = new Date(2000, 2, 7, 12, 0, 0, 0); // Tue Mar 7
      this.UpdateDateComponent(2, 2, date);

      date = new Date(2000, 3, 5, 12, 0, 0, 0); // Wed Apr 5
      this.UpdateDateComponent(3, 3, date);

      date = new Date(2000, 4, 4, 12, 0, 0, 0); // Thur May 4
      this.UpdateDateComponent(4, 4, date);

      date = new Date(2000, 5, 2, 12, 0, 0, 0); // Fri Jun 2
      this.UpdateDateComponent(5, 5, date);

      date = new Date(2000, 6, 1, 12, 0, 0, 0); // Sat Jul 1
      this.UpdateDateComponent(6, 6, date);

      date = new Date(2000, 7, 1, 12, 0, 0, 0); // Aug
      this.UpdateDateComponent(7, -1, date);

      date = new Date(2000, 8, 1, 12, 0, 0, 0); // Sep
      this.UpdateDateComponent(8, -1, date);

      date = new Date(2000, 9, 1, 12, 0, 0, 0); // Oct
      this.UpdateDateComponent(9, -1, date);

      date = new Date(2000, 10, 1, 12, 0, 0, 0); // Nov
      this.UpdateDateComponent(10, -1, date);

      date = new Date(2000, 11, 1, 12, 0, 0, 0); // Dec
      this.UpdateDateComponent(11, -1, date);

      /*
      console.info('LX', this.locale, this.date_components.short_days,
        this.date_components.long_days, this.date_components.short_months,
        this.date_components.long_months);
      */
    }

    private static UpdateDateComponent(month_index: number, day_index: number, date: Date){
      if (day_index >= 0) {
        this.date_components.short_days[day_index] = date.toLocaleString(this.locale, {weekday: 'short'});
        this.date_components.long_days[day_index] = date.toLocaleString(this.locale, {weekday: 'long'});
      }
      if (month_index >= 0) {
        this.date_components.short_months[month_index] = date.toLocaleString(this.locale, {month: 'short'});
        this.date_components.long_months[month_index] = date.toLocaleString(this.locale, {month: 'long'});
      }
    }

}

Localization.UpdateLocale(); // always call
