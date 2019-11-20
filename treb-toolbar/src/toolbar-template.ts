
import { ToolbarItem } from './toolbar-item';
import { Localization } from 'treb-base-types';
import { ToolbarOptions } from './toolbar-options';

export const sheet_structure_menu: ToolbarItem = {
  icon: 'icon-crop',
  id: 'structure',
  title: 'Rows/Columns/Sheets',
  submenu: [
    'insert row',
    'insert column',
    'delete row',
    'delete column',
    { type: 'separator' },
    'insert sheet',
    'delete sheet',
  ]
};

/**
 * considering adding file commands to the toolbar, they should
 * go in this submenu at the far left
 */
const more_menu: ToolbarItem[] = [
  {
    icon: 'icon-more_vert', id: 'more', title: 'More', submenu: [
      // ...
    ],
  },
  { type: 'separator' },
];

/**
 * testing one-icon dropdowns for horizontal/vertical align options
 */
const compressed_align_menus: ToolbarItem[] = [
  {
    icon: 'icon-format_align_left',
    id: 'align-option',
    title: 'Align Left',
    alternate_id: 'align-left',
    options: [
      { icon: 'icon-format_align_left', id: 'align-left', title: 'Align Left' },
      { icon: 'icon-format_align_center', id: 'align-center', title: 'Align Center' },
      { icon: 'icon-format_align_right', id: 'align-right', title: 'Align Right' },
    ],
  },
  { type: 'drop-down', 'related-id': 'align-option', id: 'align-dropdown' },

  {
    icon: 'icon-vertical_align_bottom',
    id: 'vertical-align-option',
    title: 'Align Bottom',
    alternate_id: 'align-bottom',
    options: [
      { icon: 'icon-vertical_align_top', id: 'align-top', title: 'Align Top' },
      { icon: 'icon-vertical_align_center', id: 'align-middle', title: 'Align Middle' },
      { icon: 'icon-vertical_align_bottom', id: 'align-bottom', title: 'Align Bottom' },
    ]
  },
  { type: 'drop-down', 'related-id': 'vertical-align-option', id: 'vertical-align-dropdown' },
  { type: 'separator' },

];

/**
 * the old (three-deep) alignment menus
 */
const expanded_align_menus: ToolbarItem[] = [

  { icon: 'icon-format_align_left', id: 'align-left', title: 'Align Left' },
  { icon: 'icon-format_align_center', id: 'align-center', title: 'Align Center' },
  { icon: 'icon-format_align_right', id: 'align-right', title: 'Align Right' },
  { type: 'separator' },

  { icon: 'icon-vertical_align_top', id: 'align-top', title: 'Align Top' },
  { icon: 'icon-vertical_align_center', id: 'align-middle', title: 'Align Middle' },
  { icon: 'icon-vertical_align_bottom', id: 'align-bottom', title: 'Align Bottom' },
  { type: 'separator' },

];

export const CreateToolbarTemplate = (options: ToolbarOptions): ToolbarItem[] => {

  const template: Array<ToolbarItem | ToolbarItem[]> = [];

  if (options.file_menu) {
    for (const item of more_menu) {
      template.push(item);
    }
  }

  const align_menus = options.compressed_align_menus ?
    compressed_align_menus :
    expanded_align_menus;

  for (const item of align_menus) {
    template.push(item);
  }

  for (const item of toolbar_template) {
    template.push(item);
  }

  return JSON.parse(JSON.stringify(template));

};

export const toolbar_template: ToolbarItem[] = [

  // ...more_menu,
  // ...compressed_align_menus,
  // ...expanded_align_menus,

  { icon: 'icon-wrap_text', id: 'wrap', title: 'Wrap Text' },
  { icon: 'icon-chat_bubble_outline', id: 'note', title: 'Add Note' },

  { type: 'separator' },

  {
    icon: 'icon-format_color_fill',
    color: true,
    id: 'fill-color',
    title: 'Background Color',
    'default-string': 'No fill',
  },

  { type: 'drop-down', 'related-id': 'fill-color', id: 'fill-color-dropdown' },
  {
    icon: 'icon-format_color_text', color: true, id: 'text-color', title: 'Text Color',
    'default-string': 'Default text color',
  },
  { type: 'drop-down', 'related-id': 'text-color', id: 'text-color-dropdown' },

  {
    icon: 'icon-border_bottom',
    id: 'border-option',
    title: 'Bottom Border',
    alternate_id: 'border-bottom',
    options: [
      { icon: 'icon-border_clear', id: 'border-none', title: 'Clear Borders' },
      { icon: 'icon-border_outer', id: 'border-outer', title: 'Outer Border' },
      { icon: 'icon-border_top', id: 'border-top', title: 'Top Border' },
      { icon: 'icon-border_bottom', id: 'border-bottom', title: 'Bottom Border' },
      { icon: 'icon-border_left', id: 'border-left', title: 'Left Border' },
      { icon: 'icon-border_right', id: 'border-right', title: 'Right Border' },
      { icon: 'icon-border_all', id: 'border-all', title: 'All Borders' },
    ],
  },

  {
    type: 'drop-down',
    'related-id': 'border-option',
    id: 'border-dropdown',
  },

  { type: 'separator' },

  { icon: 'icon-fullscreen_exit', id: 'merge', title: 'Merge Cells' },
  { icon: 'icon-fullscreen', id: 'unmerge', title: 'Unmerge Cells' },
  {
    icon: 'icon-crop', id: 'structure', title: 'Grid Rows/Columns', submenu: [
      'insert row', 'insert column', 'delete row', 'delete column',
    ],
  },

  { icon: 'icon-ac_unit', id: 'freeze2', title: 'Freeze Panes' },

  /*
  { icon: 'icon-thermometer-0', id: 'freeze', title: 'Freeze Panes' },
  { icon: 'icon-thermometer', id: 'unfreeze', title: 'Unfreeze' },
  */

  //  { type: 'separator' },

  { type: 'separator' },
  {
    type: 'input', text: '#', id: 'number-format', title: 'Number Format', submenu: [
      // 'general', 'percent', 'accounting', 'currency', 'scientific',
    ],
  },
  {
    type: 'split', submenu: [
      { id: 'decrease-decimal', text: `0${Localization.decimal_separator}0`, title: 'Decrease Precision' },
      { id: 'increase-decimal', text: `0${Localization.decimal_separator}00`, title: 'Increase Precision' },
    ],
  },

  /*
  { type: 'separator' },
  { icon: 'icon-delete', id: 'flush-simulation-results', title: 'Flush Simulation Results' },
  */

];
