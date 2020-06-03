
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
