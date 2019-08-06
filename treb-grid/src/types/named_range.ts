
import { IArea, Area } from 'treb-base-types';

export class NamedRangeCollection {

  private forward: {[index: string]: Area} = {};
  private backward: Array<{name: string, range: Area}> = [];

  public Count() {
    return this.backward.length;
  }

  /**
   * add name. names are case-insensitive. if the name already
   * exists, it will be overwritten.
   */
  public SetName(name: string, range: Area, apply = true) {
    const validated = this.ValidateNamed(name);
    if (!validated) {
      console.warn('invalid name');
      return;
    }
    if (range.entire_column || range.entire_row) {
      console.warn('invalid range');
      return;
    }
    this.forward[validated] = range;
    if (apply) {
      this.RebuildList();
    }
  }

  public SetNames(list: {[index: string]: IArea}) {
    for (const key of Object.keys(list)) {
      const area = list[key];
      this.SetName(key, new Area(area.start, area.end), false);
    }
    this.RebuildList();
  }

  public ClearName(name: string, apply = true) {
    delete this.forward[name];
    if (apply) {
      this.RebuildList();
    }
  }

  public Reset() {
    this.forward = {};
    this.backward = [];
  }

  public Get(name: string) {
    return this.forward[name.toUpperCase()];
  }

  /** FIXME: accessor */
  public Map() {
    return this.forward;
  }

  /** FIXME: accessor */
  public List() {
    return this.backward;
  }

  public RebuildList() {
    this.backward = [];
    for (const key of Object.keys(this.forward)) {
      this.backward.push({ name: key, range: this.forward[key] });
    }
  }

  /**
   * named range rules:
   *
   * - legal characters are alphanumeric, underscore and dot.
   * - must start with letter or underscore (not a number or dot).
   * - cannot look like a spreadsheet address, which is 1-3 letters followed by numbers.
   *
   * returns a normalized name (just caps, atm)
   */
  public ValidateNamed(name: string) {
    name = name.trim();
    if (!name.length) return false;
    if (/^[A-Za-z]{1,3}\d+$/.test(name)) return false;
    if (/[^A-Za-z\d_\.]/.test(name)) return false;
    if (/^[^A-Za-z_]/.test(name)) return false;
    return name.toUpperCase();
  }

}
