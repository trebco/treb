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
 * Copyright 2022-2026 trebco, llc. 
 * info@treb.app
 * 
 */


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
  command: 'insert-image'|'insert-donut-chart'|'insert-line-chart'|'insert-column-chart'|'insert-bar-chart'|'insert-scatter-plot'|'insert-box-plot';
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

export interface AdjustFontScaleToolbarMessage {
  command: 'adjust-font-scale';
  delta: number;
}

export interface FontStackToolbarMessage {
  command: 'font-stack';
  font_stack?: string;
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
  | AdjustFontScaleToolbarMessage
  | FontStackToolbarMessage
  ;
