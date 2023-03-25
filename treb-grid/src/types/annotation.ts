/*
 * This file is part of TREB.
 *
 * TREB is free software: you can redistribute it and/or modify it under the 
 * terms of the GNU General Public License as published by the Free Software 
 * Foundation, either version 3 of the License, or (at your option) any 
 * later version.
 *
 * TREB is distributed in the hope that it will be useful, but WITHOUT ANY 
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS 
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more 
 * details.
 *
 * You should have received a copy of the GNU General Public License along 
 * with TREB. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022-2023 trebco, llc. 
 * info@treb.app
 * 
 */

import type { ICellAddress, AnnotationLayout } from 'treb-base-types';
import { Rectangle } from 'treb-base-types';

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
 * UPDATE: adding a view interface for view-specific data. this is prep
 * for supporting annotations in split views; we have to change how we
 * manage nodes and callbacks.
 *  
 */

let key_generator = 100;

/**
 * moving view-specific data into a separate interface to support split.
 * nothing in view is serialized.
 */
export interface ViewData {

  /** flag indicating we have inflated this. not serialized */
  inflated?: boolean;

  /** if function exists, will be called when the annotation is resized */
  resize_callback?: () => void;
  
  /** if function exists, will be called when the annotation needs to update */
  update_callback?: () => void;

  /** layout node */
  node?: HTMLDivElement;

  /** content node */
  content_node?: HTMLDivElement;

  /** view-specific dirty flag */
  dirty?: boolean;

}

export interface ImageAnnotationData {
  src: string;
  scale: string;
  original_size: { 
    width: number; 
    height: number;
  };
}

export type AnnotationType = 'treb-chart'|'image'|'external';

/**
 * splitting persisted data from the annotation class. that class might
 * disappear in the future in favor of just a type. this interface should
 * fully match the old Partial<Annotation> we used before. note that we 
 * used to define values for all members, but they may now be undefined
 * because the Annotation class as a Partial instance of this data.
 * 
 * conceptually annotation was originally intended to support types other
 * than our own charts and images, but no one ever used it. so we could 
 * lock down the `type` field if we wanted to. or perhaps have an `external`
 * type with opaque data. TODO.
 * 
 */
export interface AnnotationDataBase {

  /** the new layout, persisted and takes preference over the old one */
  layout?: AnnotationLayout;

  /** 
   * the old layout used rectangles, and we need to keep support for
   * that. this is not the layout rectangle. this rectangle is just
   * for serialization/deserialization. the actual rectangle is maintained
   * in the Annotation class.
   */
  rect?: Partial<Rectangle>;

  /** annotation can be resized. this is advisory, for UI */
  resizable: boolean;

  /** annotation can be moved. this is advisory, for UI */
  movable: boolean;

  /** annotation can be removed/deleted. this is advisory, for UI */
  removable: boolean;

  /** annotation can be selected. this is advisory, for UI */
  selectable: boolean;

  /** move when resizing/inserting rows/columns */
  move_with_cells: boolean;

  /** resize when resizing/inserting rows/columns */
  resize_with_cells: boolean;

  /**
   * optional formula. the formula will be updated on structure events
   * (insert/delete row/column).
   */
  formula: string;

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
  extent: ICellAddress;

}

const default_annotation_data: Partial<AnnotationDataBase> = {
  move_with_cells: true,
  resize_with_cells: true,
  movable: true,
  resizable: true,
  removable: true,
  selectable: true,
};

export interface AnnotationImageData extends AnnotationDataBase {
  type: 'image';
  data: ImageAnnotationData;
}

export interface AnnotationChartData extends AnnotationDataBase {
  type: 'treb-chart';
}

export interface AnnotationExternalData extends AnnotationDataBase {
  type: 'external';
  data: Record<string, string>;
}

export type AnnotationData = AnnotationChartData | AnnotationImageData | AnnotationExternalData;

/**
 * why is this a class? it doesn't do anything.
 * FIXME: -> interface
 */
export class Annotation {

  public data: Partial<AnnotationData> = {
    ...default_annotation_data
  };

  /** 
   * the key field is used to identify and coordinate annotations when we 
   * have freeze panes. when an annotation crosses a freeze pane, we need
   * two copies of the rendered node so that we can scroll. we use the key
   * to match the frozen/unfrozen instances.
   */
  public get key(): number { return this.key_; }

  /** coordinates, in sheet space */
  public rect?: Rectangle;

  // public get rect(): Rectangle|undefined { return this.rect_; }

  /** display coordinates, possibly scaled. not persisted. */
  public scaled_rect?: Rectangle;

  /** also opaque data, but not serialized. */
  public temp: any = {};

  public view: ViewData[] = [];

  /**
   * advisory, meaning we probably need an update if there's an opportunity.
   * only advisory and not persisted.
   */
  public dirty?: boolean;

  private key_ = (key_generator++);

  /**
   * constructor takes persisted data
   */
  constructor(opts: Partial<AnnotationData> = {}) {
    this.data = {
      ...default_annotation_data,
      ...JSON.parse(JSON.stringify(opts))
    }; // why clone?
    if (opts.rect) {
      this.rect = Rectangle.Create(opts.rect);
    }
  }

  /**
   * serialization just returns persisted data, plus we update the 
   * rectangle. 
   * 
   * anyone serializing annotations should just be fetching the data
   * object, but we're leaving this in place because we can't trace 
   * it back using tooling. that's a real drawback of toJSON, we 
   * should stop using it.
   * 
   * although as long as we need to support `rect` here, it's not bad
   * that we do it this way. perhaps change the function name, and 
   * call it directly?
   * 
   */
  public toJSON(): Partial<AnnotationData> {
    return {
      ...this.data, rect: this.rect };
  }

}
