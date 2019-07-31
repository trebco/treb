
import { GridSelection } from './grid_selection';
import { SheetEvent } from './sheet_types';
import { Annotation } from './annotation';

export interface GridSelectionEvent {
  type: 'selection';
  selection: GridSelection;
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

export type GridEvent
  = GridSelectionEvent
  | StructureEvent
  | SheetEvent
  | AnnotationEvent
  ;
