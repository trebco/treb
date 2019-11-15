
export interface ToolbarItem {
  type?: 'separator'|'input'|'button'|'drop-down'|'split';
  text?: string;
  icon?: string;
  class?: string;
  title?: string;
  value?: string;
  color?: boolean;
  'default-string'?: string;
  id?: string;
  alternate_id?: string;
  'related-id'?: string;
  property?: string;
  submenu?: Array<string|ToolbarItem>;
  options?: Array<string|ToolbarItem>;
  selection?: number;
  'second-color'?: string;
}
