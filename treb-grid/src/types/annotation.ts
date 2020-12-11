
import { Rectangle, ICellAddress } from 'treb-base-types';

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

  /** display coordinates, possibly scaled. not persisted. */
  public scaled_rect?: Rectangle;

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

  /** content node */
  public content_node?: HTMLDivElement;

  /**
   * optional formula. the formula will be updated on structure events
   * (insert/delete row/column).
   */
  public formula = '';

  /** 
   * extent, useful for exporting. we could probably serialize this,
   * just be sure to clear it when layout changes so it will be
   * recalculated.
   * 
   * the idea is to know the bottom/right row/column of the annotation,
   * so when we preserve/restore the sheet we don't trim those rows/columns.
   * they don't need any data, but it just looks bad. we can do this 
   * dynamically but since it won't change all that often, we might 
   * as well precalculate.
   */
  public extent?: ICellAddress;

  /**
   * constructor takes a property bag (from json, generally). note that
   * if you are iterating keys on `this`, there has to be an initial value
   * or the key won't exist.
   */
  constructor(opts: any = {}) {
    for (const key of Object.keys(this)){
      if (key !== 'rect' && key !== 'cell_address' && opts[key]) (this as any)[key] = opts[key];
    }
    if (opts.rect) {
      this.rect = Rectangle.Create(opts.rect);
    }
  }

  /**
   * serialization method drops node and trims
   */
  public toJSON(): Partial<Annotation> {
    const result: Partial<Annotation> = { rect: this.rect };

    if (this.data) result.data = this.data;
    if (this.formula) result.formula = this.formula;
    if (this.type) result.type = this.type;

    if (!this.resizable) result.resizable = this.resizable;
    if (!this.movable) result.movable = this.movable;
    if (!this.removable) result.removable = this.removable;
    if (!this.selectable) result.selectable = this.selectable;

    if (!this.move_with_cells) result.move_with_cells = this.move_with_cells;
    if (!this.resize_with_cells) result.resize_with_cells = this.resize_with_cells;

    if (this.extent) result.extent = this.extent;

    return result;
  }

}
