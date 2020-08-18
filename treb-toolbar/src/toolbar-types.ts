
export interface ToolbarIconPath {
  d: string;
  style?: string;
  classes?: string|string[];
}
  
export interface ToolbarIconDefinition {
  viewbox?: string;
  paths?: ToolbarIconPath[];
}

export interface ToolbarElementBase {
  dropdown?: 'color'|'list';
  id?: string;
  related_id?: string;
  title?: string;
  node?: HTMLElement;
  list?: ToolbarElement[];
  text?: string;
  active?: boolean;
  disabled?: boolean;

  /** opaque user data */
  data?: any;
}

export interface ToolbarButton extends ToolbarElementBase {
  type: 'button';
  // icon?: Element;
  icon?: ToolbarIconDefinition;
}

export interface ToolbarSplitButton extends ToolbarElementBase {
  type: 'split';
  top: ToolbarButton;
  bottom: ToolbarButton;
}

export interface ToolbarInputField extends ToolbarElementBase {
  type: 'input',
  placeholder?: string;
}

export interface ToolbarTextField extends ToolbarElementBase {
  type: 'text',
}

export interface ToolbarSeparator extends ToolbarElementBase {
  type: 'separator',
}

export type ToolbarElement
  = ToolbarButton 
  | ToolbarTextField
  | ToolbarInputField
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
