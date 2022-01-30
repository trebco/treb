
/**
 * the aim of this is to convert some number of ml into US 
 * volume measurement, using cups, tablespoons and teaspoons
 * (and a pinch) in a logical way that honors standard measuring 
 * tools.
 * 
 * NOTE: and pints, gallons, and quarts, although I'm less worried
 * about those (and they are easier).
 * 
 * NOTE: suppose you are under (e.g.) 3/4 cup, but only by 1tsp. in
 * that case do you want to do some crazy measurement gymnastics 
 * (meaning 1/2 cup + 3tsp + 1tsp), or just round up? and what are
 * the thresholds? should they be parameterized?
 * 
 */

// NOTE: these aren't interchangable -- we should perhaps average and
// work backwards, although it won't make that much of a difference

const tsp_ml = 4.92892;
const tbsp_ml = 14.7868;
const cup_ml = 236.588;

/**
 * volume of a unit, plus (allowed) fractions. different units may 
 * support different fractional values (for example, 1/3 cup is common 
 * but 1/3 tbsp is not).
 * 
 * unit should theoretically be required but we want to more easily 
 * support empty results, so...
 */
export interface VolumeMeasure {
  unit: number;
  '3/4': number;
  '1/2': number;
  '1/3': number;
  '1/4': number;
}

export interface USVolume {

  // TODO: pints, quarts, gallons

  cup: Partial<VolumeMeasure>;
  tbsp: Partial<VolumeMeasure>;
  tsp: Partial<VolumeMeasure>;
  pinch: Partial<VolumeMeasure>;

}

interface FitResult {
  ml: number;
  count: number;
  next?: boolean;
}

export class Converter {

  public us_volume_template: Partial<USVolume> = {
  
    cup: {
      unit: cup_ml,
      '3/4': cup_ml * 3 / 4,
      '1/2': cup_ml / 2,
      '1/3': cup_ml / 3,
      '1/4': cup_ml / 4,
    },

    tbsp: {
      unit: tbsp_ml,
      '1/2': tbsp_ml / 2,
    },

    tsp: {
      unit: tsp_ml,
      '3/4': tsp_ml * 3 / 4, // this is nonstandard, but easy to get there
      '1/2': tsp_ml / 2,
      '1/4': tsp_ml / 4,
    },

  };

  public unit_list: Array<{
    base: keyof USVolume,
    fraction: keyof VolumeMeasure,
    value: number,
  }>;

  constructor() {

    const result: Array<{
      base: keyof USVolume,
      fraction: keyof VolumeMeasure,
      value: number,
    }> = [];

    for (const base of Object.keys(this.us_volume_template) as Array<keyof USVolume>) {
      const unit = this.us_volume_template[base];
      if (unit) {
        for (const fraction of Object.keys(unit) as Array<keyof VolumeMeasure>) {
          const unit_fraction = unit[fraction] as number;
          result.push({
            base, 
            fraction, 
            value: unit_fraction,
          });
        }
      }
    }

    // we probably preserve sort order, but just in case
    result.sort((a, b) => b.value - a.value);

    this.unit_list = result;

  }

  public Pluralize(value: number, unit: string): string {
    const lc = unit.toLowerCase();
    if (value === 0 || value > 1) {
      if (lc === 'cup') {
        return unit + 's';
      }
    }
    return unit;
  }

  public Render(volume: Partial<USVolume>): string {

    if (volume.pinch) {
      return 'pinch';
    }

    const composite: string[] = [];
    let s: string[] = [];
    let active_base = '';
    let active_value = 0;

    for (const element of this.unit_list) {
      const { base, fraction } = element;

      if (base !== active_base) {

        if (active_base && s.length) {
          composite.push(s.join(' ') + ' ' + this.Pluralize(active_value, active_base));
        }
        active_base = base;
        active_value = 0;
        s = [];
      }

      if (volume[base] && (volume[base] as any)[fraction]) {
        if (fraction === 'unit') {
          s.push((volume[base] as any).unit.toString());
          active_value += ((volume[base] as any).unit || 0);
        }
        else {
          s.push(fraction);
          active_value += 0.5;
        }
      }
    }

    if (active_base && s.length) {
      composite.push(s.join(' ') + ' ' + this.Pluralize(active_value, active_base));
    }

    return composite.join(' + ');
  }


  /**
   * this method applies error to the TOTAL value, so we're not
   * constantly reducing error. the idea is to get the smallest
   * unit set that falls within error bounds.
   *
   * update: if you're going to fudge, check the _next_ unit and see
   * if fudging there results in lower error. if so, do that.
   */
   public FitAggregateError2(label: string, ml: number, unit_ml: number, next_unit_ml: number, target: number, err = 0.04): FitResult {

    if (ml <= 0) {
      return { count: 0, ml };
    }

    const count = Math.floor(ml / unit_ml);
    const remainder = ml - count * unit_ml;

    // test if we can throw in one more unit, within error.
    // if so, that will take up the balance.

    if ((remainder + err * target) >= unit_ml ){

      if (next_unit_ml) {
        const check_err_1 = Math.abs(remainder - unit_ml) / remainder;
        const check_err_2 = Math.abs(remainder - next_unit_ml) / remainder;

        // console.info(`(${count} ${label}) adding fudge. check next...`, check_err_1, check_err_2);

        if (check_err_2 < check_err_1) {
          return {
            count, ml: remainder, next: true,
          }
        }

      }

      return {
        count: count + 1,
        ml: 0,
      };
    }

    // if remainder < error we can drop it (FIXME: depending on units? ...)

    if ((remainder / target) < err) {
      return {
        ml: 0,
        count,
      };
    }

    return {
      ml: remainder, 
      count,
    };

  }

  /**
   * this method applies error to the TOTAL value, so we're not
   * constantly reducing error. the idea is to get the smallest
   * unit set that falls within error bounds.
   *
   */
  public FitAggregateError(ml: number, unit_ml: number, target: number, err = 0.04): FitResult {

    if (ml <= 0) {
      return { count: 0, ml };
    }

    const count = Math.floor(ml / unit_ml);
    const remainder = ml - count * unit_ml;

    // test if we can throw in one more unit, within error.
    // if so, that will take up the balance.

    if ((remainder + err * target) >= unit_ml ){
      return {
        count: count + 1,
        ml: 0,
      };
    }

    // if remainder < error we can drop it (FIXME: depending on units? ...)

    if ((remainder / target) < err) {
      return {
        ml: 0,
        count,
      };
    }

    return {
      ml: remainder, 
      count,
    };

  }

  /**
   * convert US volume value to ml. this can be exact, since the 
   * result is ml (although we'll probably round to whole numbers).
   */
  public ConvertUSVolume(volume: Partial<USVolume>): number {

    let ml = 0;

    // special case: pinch is 1/8 tsp
    if (volume.pinch?.unit) {

      // yes this is ugly but I know this value exists
      // should be a way to specify... use a more concrete type

      ml = volume.pinch.unit * (this.us_volume_template as any).tsp['1/4'] * .5;
    }

    for (const base of Object.keys(volume) as Array<keyof USVolume>) {
      const vm = volume[base] as Partial<VolumeMeasure>;
      const template = this.us_volume_template[base];
      if (!template) {
        throw new Error('invalid unit type: ' + base);
      }

      for (const fraction of Object.keys(vm) as Array<keyof VolumeMeasure>) {
        if (!template[fraction]) {
          throw new Error('invalid unit fraction: ' + fraction + ' ' + base);
        }

        // the problem here is that ts doesn't believe these array indexes...

        ml += (template as any)[fraction] * (vm as any)[fraction];
      }

    }

    return ml;
  }

  /**
   * convert arbitrary ml value to our US volume units. aggregate error.
   */
  public ConvertML(ml: number, err?: number, strategy = 1): Partial<USVolume> {
    const result: Partial<USVolume> = {};

    // special case: pinch is 1/8 tsp. we fudge so it's anywhere in
    // (.75, .25) tsp. more than that and round up. this is more than
    // the standard error. pinch is never a remainder, it only appears
    // as a unique volume.

    const qt = (this.us_volume_template as any).tsp['1/4'];
    if (ml < qt) {
      if (ml >= qt * .75) {
        result.tsp = { '1/4': 1 };
      }
      else if (ml >= qt * .25) {
        result.pinch = { unit: 1 };
      }
      return result;
    }

    const target = ml;

    for (let i = 0; i < this.unit_list.length; i++) {
      const entry = this.unit_list[i];
      const next_entry = this.unit_list[i + 1];

    // for (const entry of this.unit_list) {
      // const fit = Fit(ml, entry.value);
      // const fit = FitExact(ml, entry.value);

      const fit = (strategy === 1) ?
        this.FitAggregateError2(entry.fraction + ' ' + entry.base, ml, entry.value, next_entry?.value || 0, target, err)
        : this.FitAggregateError(ml, entry.value, target, err);
      
      if (fit.count > 0) {
        if (!result[entry.base]) {
          result[entry.base] = {};
        }
        (result[entry.base] as any)[entry.fraction] = fit.count;
        ml = fit.ml;
      }

      if (fit.next) {
        if (!result[next_entry.base]) {
          result[next_entry.base] = {};
        }
        (result[next_entry.base] as any)[next_entry.fraction] = 1;
        ml = 0;
      }

    }
    return result;
  }

}

export const USVolumeConverter = new Converter();
