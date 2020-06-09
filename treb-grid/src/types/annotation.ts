
import { Rectangle, Area } from 'treb-base-types';

/**
 * new annotation class. annotations are arbitrary content
 * inserted into the sheet, using a floating div element. the
 * class is serialized with the sheet, so the caller can recreate
 * the content if desired.
 *
 * because there's an element of layout involved, callers should
 * interact with annotations through the grid class rather than the
 * sheet.
 */

export class Annotation {

  /** coordinates, in sheet space */
  public rect?: Rectangle;

  /** opaque data. this is serialized, so it's persistent data */
  public data: any = {};

  /** type, for filtering. ensure a value */
  public type = '';

  /** also opaque data, but not serialized. */
  public temp: any = {};

  /** flag indicating we have inflated this. not serialized */
  public inflated = false;

  /** if function exists, will be called when the annotation is resized */
  public resize_callback?: () => void;

  /** if function exists, will be called when the annotation needs to update */
  public update_callback?: () => void;

  /** annotation can be resized. this is advisory, for UI */
  public resizable = true;

  /** annotation can be moved. this is advisory, for UI */
  public movable = true;

  /** annotation can be removed/deleted. this is advisory, for UI */
  public removable = true;

  /** annotation can be selected. this is advisory, for UI */
  public selectable = true;

  /** move when resizing/inserting rows/columns */
  public move_with_cells = true;

  /** resize when resizing/inserting rows/columns */
  public resize_with_cells = true;

  /** layout node, obviously not serialized */
  public node?: HTMLDivElement;

  /**
   * optional formula. the formula will be updated on structure events
   * (insert/delete row/column).
   */
  public formula = '';


  /**
   * constructor takes a property bag (from json, generally). note that
   * if you are iterating keys on `this`, there has to be an initial value
   * or the key won't exist.
   */
  constructor(opts: any = {}) {
    for (const key of Object.keys(this)){
      if (key !== 'rect' && key !== 'cell_address' && opts[key]) (this as any)[key] = opts[key];
    }
    if (opts.rect) this.rect = Rectangle.Create(opts.rect);
  }

  /**
   * serialization method drops node and trims
   */
  public toJSON(){
    const result: any = { rect: this.rect };

    if (this.data) result.data = this.data;
    if (this.formula) result.formula = this.formula;
    if (this.type) result.type = this.type;

    if (!this.resizable) result.resizable = this.resizable;
    if (!this.movable) result.movable = this.movable;
    if (!this.removable) result.removable = this.removable;
    if (!this.selectable) result.selectable = this.selectable;

    if (!this.move_with_cells) result.move_with_cells = this.move_with_cells;
    if (!this.resize_with_cells) result.resize_with_cells = this.resize_with_cells;

    return result;
  }

}
