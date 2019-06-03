
/**
 * FIXME: it's possible to scrape these for i18n using the js
 * function toLocaleDateFormat(). TODO. (done? check IE11).
 */

export class DateComponents {

  public static short_days = [
    'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat',
  ];

  public static long_days = [
    'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday',
  ];

  public static short_months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  public static long_months = [
    'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December',
  ];

  public static Localize(locale = 'en-US'){

    // let locale = 'en-US'; // default

    // handle node as well
    if ((typeof self !== 'undefined') && (self as any).navigator && (self as any).navigator.language) {
      locale = (self as any).navigator.language;
    }

    let date = new Date(2000, 0, 2, 12, 0, 0, 0); // Sun Jan 2
    this.Update(0, 0, date, locale);

    date = new Date(2000, 1, 7, 12, 0, 0, 0); // Mon Feb 7
    this.Update(1, 1, date, locale);

    date = new Date(2000, 2, 7, 12, 0, 0, 0); // Tue Mar 7
    this.Update(2, 2, date, locale);

    date = new Date(2000, 3, 5, 12, 0, 0, 0); // Wed Apr 5
    this.Update(3, 3, date, locale);

    date = new Date(2000, 4, 4, 12, 0, 0, 0); // Thur May 4
    this.Update(4, 4, date, locale);

    date = new Date(2000, 5, 2, 12, 0, 0, 0); // Fri Jun 2
    this.Update(5, 5, date, locale);

    date = new Date(2000, 6, 1, 12, 0, 0, 0); // Sat Jul 1
    this.Update(6, 6, date, locale);

    date = new Date(2000, 7, 1, 12, 0, 0, 0); // Aug
    this.Update(7, -1, date, locale);

    date = new Date(2000, 8, 1, 12, 0, 0, 0); // Sep
    this.Update(8, -1, date, locale);

    date = new Date(2000, 9, 1, 12, 0, 0, 0); // Oct
    this.Update(9, -1, date, locale);

    date = new Date(2000, 10, 1, 12, 0, 0, 0); // Nov
    this.Update(10, -1, date, locale);

    date = new Date(2000, 11, 1, 12, 0, 0, 0); // Dec
    this.Update(11, -1, date, locale);

    // console.info(this.short_days, this.long_days, this.short_months, this.long_months);

  }

  private static Update(month_index: number, day_index: number, date: Date, locale: string){
    if (day_index >= 0) {
      this.short_days[day_index] = date.toLocaleString(locale, {weekday: 'short'});
      this.long_days[day_index] = date.toLocaleString(locale, {weekday: 'long'});
    }
    if (month_index >= 0) {
      this.short_months[month_index] = date.toLocaleString(locale, {month: 'short'});
      this.long_months[month_index] = date.toLocaleString(locale, {month: 'long'});
    }
  }

}

DateComponents.Localize();
