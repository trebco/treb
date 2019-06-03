
import { GridSelection } from './grid_selection';
import { SheetEvent } from './sheet_types';

export interface GridSelectionEvent {
  type: 'selection';
  selection: GridSelection;
}

export interface StructureEvent {
  type: 'structure';
}

export type GridEvent = GridSelectionEvent | StructureEvent | SheetEvent;
