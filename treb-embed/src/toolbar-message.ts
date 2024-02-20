
import type { Color } from 'treb-base-types';

/* 
 * this is an attempt to lock down toolbar commands, and better 
 * manage type data along with those commands. data should always 
 * be optional (not in practice, but in typings).
 */

export interface SetColorToolbarMessage {
  command: 'fill-color'|'text-color'|'border-color';
  color?: Color
}

export interface CommentToolbarMessage {
  command: 'update-comment'|'clear-comment';
  comment?: string;
}

export interface BorderToolbarMessage {
  command: 'border-top'|'border-bottom'|'border-left'|'border-right'|'border-all'|'border-outside'|'border-none'|'border-double-bottom';
  color?: Color;
}

export interface AnnotationToolbarMessage {
  command: 'insert-image'|'insert-donut-chart'|'insert-line-chart'|'insert-column-chart'|'insert-bar-chart';
}

export interface LayoutToolbarMessage {
  command: 'insert-row'|'delete-row'|'insert-column'|'delete-column'|'insert-sheet'|'delete-sheet';
}

export interface PrecisionToolbarMessage {
  command: 'increase-precision'|'decrease-precision';
}

export interface IOToolbarMessage {
  command: 'import-file'|'export-xlsx'|'save-json'|'save-csv';
}

export interface MergeToolbarMessage {
  command: 'merge-cells'|'unmerge-cells';
}

export interface AlignToolbarMessage {
  command: 'align-top'|'align-middle'|'align-bottom';
}

export interface JustifyToolbarMessage {
  command: 'justify-left'|'justify-center'|'justify-right';
}

export interface FontScaleToolbarMessage {
  command: 'font-scale';
  scale?: number;
}

export interface NumberFormatToolbarMessage {
  command: 'number-format';
  format?: string;
}

export interface TableToolbarMessage {
  command: 'insert-table'|'remove-table';
}

export interface CommandToolbarMessage {
  command: 'reset'|'recalculate'|'freeze-panes'|'about'|'revert';
}

export interface StyleToolbarMessage {
  command: 'wrap-text'|'lock-cells';
}

export interface UIToolbarMessage {
  command: 'toggle-toolbar'|'show-toolbar'|'hide-toolbar'|'toggle-sidebar'|'show-sidebar'|'hide-sidebar';
}

export interface RevertIndicatorMessage {
  command: 'revert-indicator';
}

export interface IndentMessage {
  command: 'indent'|'outdent';
}

export type ToolbarMessage 
  = SetColorToolbarMessage 
  | CommentToolbarMessage 
  | IOToolbarMessage
  | UIToolbarMessage
  | MergeToolbarMessage
  | BorderToolbarMessage
  | LayoutToolbarMessage
  | AnnotationToolbarMessage
  | PrecisionToolbarMessage
  | JustifyToolbarMessage
  | RevertIndicatorMessage
  | AlignToolbarMessage
  | TableToolbarMessage
  | CommandToolbarMessage
  | StyleToolbarMessage
  | IndentMessage
  | NumberFormatToolbarMessage
  | FontScaleToolbarMessage
  ;
