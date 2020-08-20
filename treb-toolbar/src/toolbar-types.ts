import { Toolbar } from './toolbar';

export interface ToolbarIconPath {
  d: string;
  style?: string;
  classes?: string|string[];
}
  
export interface ToolbarIconDefinition {
  viewbox?: string;
  paths?: ToolbarIconPath[];
}

export const enum ToolbarElementType {
  button, split, input, text, hidden, separator
}

export interface ToolbarElementBase {
  dropdown?: 'color'|'list'|'button-list'|'button-color'|'button-custom';
  content?: HTMLElement;
  show?: () => void;
  
  id?: string;
  related_id?: string;
  title?: string;
  node?: HTMLElement;
  list?: ToolbarElement[];
  text?: string;
  active?: boolean;
  disabled?: boolean;
  parent_id?: string;

  /** opaque user data */
  data?: any;
}

export interface ToolbarButton extends ToolbarElementBase {
  type: ToolbarElementType.button; // 'button';
  icon?: ToolbarIconDefinition;
}

export interface ToolbarSplitButton extends ToolbarElementBase {
  type: ToolbarElementType.split; //'split';
  top: ToolbarButton;
  bottom: ToolbarButton;
}

export interface ToolbarInputField extends ToolbarElementBase {
  type: ToolbarElementType.input; //'input',
  placeholder?: string;
}

export interface ToolbarTextField extends ToolbarElementBase {
  type: ToolbarElementType.text; //'text',
}

export interface ToolbarHiddenField extends ToolbarElementBase {
  type: ToolbarElementType.hidden; //'hidden',
}

export interface ToolbarSeparator extends ToolbarElementBase {
  type: ToolbarElementType.separator; //'separator',
}

export type ToolbarElement
  = ToolbarButton 
  | ToolbarTextField
  | ToolbarInputField
  | ToolbarHiddenField
  | ToolbarSeparator
  | ToolbarSplitButton
  ;

export interface ToolbarEvent {
  type?: 'focusout'|'button'|'cancel'|'input';
  element?: ToolbarElement;
  id?: string;
  related_id?: string;
  color?: string;
  value?: string;
}
