
import type { GridSelection } from './grid_selection';
import type { Annotation } from './annotation';
import type { Sheet } from './sheet';
import type { Area } from 'treb-base-types';

export enum ErrorCode {

  /** no error: zero so it's falsy */
  None = 0,

  /** placeholder for new errors */
  Unknown,

  /** you can't change part of an array */
  Array,

  /** invalid value (data validation) */
  DataValidation,

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
