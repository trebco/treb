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
 * Copyright 2022-2024 trebco, llc. 
 * info@treb.app
 * 
 */

import type { GridSelection } from './grid_selection';
import type { Annotation } from './annotation';
import type { Sheet } from './sheet';
import type { Area } from 'treb-base-types';

export enum ErrorCode {

  /** no error: zero so it's falsy */
  none = 0,

  /** placeholder for new errors */
  unknown,

  /** you can't change part of an array */
  array,

  /** invalid value (data validation) */
  data_validation,

  /** invalid area for insert table: there's a merge, array or existing table within the range */
  invalid_area_for_table,

  /** invalid area for paste, same as invalid area for table */
  invalid_area_for_paste,

}

export interface SheetChangeEvent {
  type: 'sheet-change';
  activate: Sheet;
  deactivate: Sheet;
}

export interface GridSelectionEvent {
  type: 'selection';
  selection: GridSelection;
}

export interface GridAlternateSelectionEvent {
  type: 'alternate-selection';
  selection: GridSelection;
}

/**
 * we used to return strings here, changed to error codes for l10n
 */
export interface GridErrorEvent {
  type: 'error';
  code: ErrorCode;
}

export interface StructureEvent {
  type: 'structure';

  /**
   * this flag should be set if the structure change changes references,
   * insert or delete events. resize events don't need to set it.
   *
   * FIXME: merge/unmerge? (...) I think yes
   */
  rebuild_required?: boolean;
}

export interface AnnotationEvent {
  type: 'annotation';
  annotation?: Annotation;
  event?: 'move'|'resize'|'create'|'delete'|'update';
}

export interface CellEvent {
  type: 'cell-event',
  data?: any,
}

export interface DataEvent {
  type: 'data';
  area?: Area;
}

export interface FlushEvent {
  type: 'flush';
}

export interface StyleEvent {
  type: 'style';
  area?: Area;
}

export interface ScaleEvent {
  type: 'scale';
  scale: number;
}

export type GridEvent
  = DataEvent
  | CellEvent
  | StyleEvent
  | FlushEvent
  | ScaleEvent
  | GridErrorEvent
  | StructureEvent
  | AnnotationEvent
  | SheetChangeEvent
  | GridSelectionEvent
  | GridAlternateSelectionEvent
  ;
