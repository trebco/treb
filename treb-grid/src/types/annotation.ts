
import { Rectangle, ICellAddress, ICellAddress2 } from 'treb-base-types';

/**
 * offset from corner, as % of cell
 */
export interface Offset {
  x: number;
  y: number;
}

export interface Corner {
  address: ICellAddress;
  offset: Offset;
}  

export interface AnnotationLayout {
  tl: Corner;
  br: Corner;
}

/**
 * new annotation class. annotations are arbitrary content
 * inserted into the sheet, using a floating div element. the
 * class is serialized with the sheet, so the caller can recreate
 * the content if desired.
 *
 * because there's an element of layout involved, callers should
 * interact with annotations through the grid class rather than the
 * sheet.
 * 
 * we are redesigning layout so that instead of a rectangle, in 
 * coordinate space, annotations use extents and offsets in cell space.
 * so layout should now have a TL cell and a BR cell plus offsets for 
 * each. Offset is implemented as a % of the given cell, so offsets are 
 * inverted in the TL/BR cells.
 * 
 * UPDATE: actually while the inverted BR offset makes intuitive sense,
 * it doesn't make technical sense -- easier to always calcluate offsets
 * in the same direction. so offsets are always positive.
 * 
 * we'll leave the old extent in there (for now, at least) to prevent
 * any unintended consequences. 
 * 
 */

export class Annotation {

  /** coordinates, in sheet space */
  public rect?: Rectangle;

  // public get rect(): Rectangle|undefined { return this.rect_; }

  /** display coordinates, possibly scaled. not persisted. */
  public scaled_rect?: Rectangle;

  /** the new layout, persisted and takes preference over the old one */
  public layout?: AnnotationLayout;

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
   * advisory, meaning we probably need an update if there's an opportunity.
   * only advisory and not persisted.
   */
  public dirty?: boolean;

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
  constructor(opts: Partial<Annotation>&{rect?: Partial<Rectangle>} = {}) {
    for (const key of Object.keys(this) as Array<keyof Annotation>){
      if (key !== 'layout' // && key !== 'rect' 
          && opts[key]) { // key !== 'cell_address' && opts[key]) {
        (this as any)[key] = opts[key];
      }
    }

    if (opts.layout) {
      this.layout = JSON.parse(JSON.stringify(opts.layout));
    }
    if (opts.rect) {
      this.rect = Rectangle.Create(opts.rect);
    }
  }

  /**
   * serialization method drops node and trims
   */
  public toJSON(): Partial<Annotation> {
    const result: Partial<Annotation> = {}; // { rect: this.rect };

    if (this.data) result.data = this.data;
    if (this.formula) result.formula = this.formula;
    if (this.type) result.type = this.type;

    if (!this.resizable) result.resizable = this.resizable;
    if (!this.movable) result.movable = this.movable;
    if (!this.removable) result.removable = this.removable;
    if (!this.selectable) result.selectable = this.selectable;

    if (!this.move_with_cells) result.move_with_cells = this.move_with_cells;
    if (!this.resize_with_cells) result.resize_with_cells = this.resize_with_cells;

    if (this.layout) result.layout = this.layout;
    if (this.extent) result.extent = this.extent;

    return result;
  }

}
