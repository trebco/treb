
export interface ToolbarOptions {
  add_delete_sheet?: boolean;
  compressed_align_menus?: boolean;
  file_toolbar?: boolean;
  file_menu?: boolean;
}

export const DefaultToolbarOptions: ToolbarOptions = {
  add_delete_sheet: false,
  file_toolbar: false,
  compressed_align_menus: false,
  file_menu: false,
};

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
