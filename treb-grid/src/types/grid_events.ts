
import { GridSelection } from './grid_selection';
import { SheetEvent } from './sheet_types';
import { Annotation } from './annotation';

export interface GridSelectionEvent {
  type: 'selection';
  selection: GridSelection;
}

export interface StructureEvent {
  type: 'structure';
}

export interface AnnotationEvent {
  type: 'annotation';
  annotation?: Annotation;
  event?: 'move'|'resize'|'create'|'delete';
}

export type GridEvent
  = GridSelectionEvent
  | StructureEvent
  | SheetEvent
  | AnnotationEvent
  ;
