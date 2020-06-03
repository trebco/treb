
import { ToolbarItem } from './toolbar-item';
import { Localization } from 'treb-base-types';
import { ToolbarOptions } from './toolbar-options';

/** 
 * dropdown menu for add/remove sheet. this will get added to 
 * the structure menu if the appropriate option is set.
 */
const sheet_structure_menu: ToolbarItem[] = [
  { type: 'separator' },
  { text: 'Insert Sheet', id: 'insert-sheet' },
  { text: 'Delete Sheet', id: 'delete-sheet' },
];

/** 
 * base structure menu is always displayed (?)
 */
const base_structure_menu: ToolbarItem =   {

  icon: 'crop',
  // icon: 'fa5-duotone-line-columns',
  // icon: 'fa5-regular-line-columns',

  id: 'structure',
  title: 'Grid Rows/Columns',
  submenu: [
    { text: 'Insert Row', id: 'insert-row' },
    { text: 'Insert Column', id: 'insert-column' },
    { text: 'Delete Row', id: 'delete-row' },
    { text: 'Delete Column', id: 'delete-column' },
  ],

};

/**
 * considering adding file commands to the toolbar, they should
 * go in this submenu at the far left
 */
const more_menu: ToolbarItem[] = [
  {
    icon: 'vertical-dots', id: 'more', title: 'More', submenu: [
      'Save TREB (JSON) File',
      'Save as XLSX',
    ],
  },
  { type: 'separator' },
];

/**
 * file menu for full-screen
 */
const file_menu: ToolbarItem[] = [
  /*
  { id: 'save', title: 'Save to Desktop', icon: 'fa5-solid-save' },
  { id: 'load', title: 'Open Desktop File', icon: 'fa5-solid-folder-open' },
  { id: 'new', title: 'New Document', icon: 'fa5-regular-file' },
  */

 { id: 'save', title: 'Save to Desktop', icon: 'material-outline-save_alt-24px' },
 { id: 'load', title: 'Open Desktop File', icon: 'material-outline-folder-24px' },
 { id: 'new', title: 'New Document', icon: 'material-outline-insert_drive_file-24px' },

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

  { icon: 'align-left', id: 'align-left', title: 'Align Left' },
  { icon: 'align-center', id: 'align-center', title: 'Align Center' },
  { icon: 'align-right', id: 'align-right', title: 'Align Right' },

  { type: 'separator' },

  { icon: 'align-top', id: 'align-top', title: 'Align Top' },
  { icon: 'align-middle', id: 'align-middle', title: 'Align Middle' },
  { icon: 'align-bottom', id: 'align-bottom', title: 'Align Bottom' },

  { type: 'separator' },

];

export const toolbar_template: ToolbarItem[] = [

  // ...more_menu,
  // ...compressed_align_menus,
  // ...expanded_align_menus,

  { icon: 'material-outline-wrap_text-24px', id: 'wrap', title: 'Wrap Text' },
  { icon: 'material-outline-chat_bubble_outline-24px', id: 'note', title: 'Add Comment' },

  { type: 'separator' },

  {
    icon: 'fill-color',
    // icon: 'fa5-duotone-fill-drip',
    color: true,
    id: 'fill-color',
    title: 'Background Color',
    'default-string': 'No fill',
  },

  { type: 'drop-down', 'related-id': 'fill-color', id: 'fill-color-dropdown' },
  {
    icon: 'text-color', 
    // icon: 'fa5-duotone-font',
    color: true, id: 'text-color', title: 'Text Color',
    'default-string': 'Default text color',
  },
  { type: 'drop-down', 'related-id': 'text-color', id: 'text-color-dropdown' },

  {
    icon: 'border-bottom',
    id: 'border-option',
    title: 'Bottom Border',
    alternate_id: 'border-bottom',
    options: [

      { icon: 'border-none', id: 'border-none', title: 'Clear Borders' },
      { icon: 'border-outside', id: 'border-outer', title: 'Outer Border' },
      { icon: 'border-top', id: 'border-top', title: 'Top Border' },
      { icon: 'border-bottom', id: 'border-bottom', title: 'Bottom Border' },
      { icon: 'border-left', id: 'border-left', title: 'Left Border' },
      { icon: 'border-right', id: 'border-right', title: 'Right Border' },
      { icon: 'border-all', id: 'border-all', title: 'All Borders' },
    
    ],
  },

  {
    type: 'drop-down',
    'related-id': 'border-option',
    id: 'border-dropdown',
  },

  { type: 'separator' },

  { icon: 'merge-cells', id: 'merge', title: 'Merge Cells' },
  { icon: 'unmerge-cells', id: 'unmerge', title: 'Unmerge Cells' },

  base_structure_menu, // may be updated

  // { icon: 'snowflake', id: 'freeze2', title: 'Freeze Panes' },
  { icon: 'snowflake', id: 'freeze3', title: 'Freeze Panes' },
  { icon: 'snowflake', id: 'unfreeze3', title: 'Unfreeze Panes' },

  /*
  { icon: 'icon-thermometer-0', id: 'freeze', title: 'Freeze Panes' },
  { icon: 'icon-thermometer', id: 'unfreeze', title: 'Unfreeze' },
  */

  //  { type: 'separator' },

  { type: 'separator' },
  {
    type: 'input', 
    text: 'p', 
    icon: 'number-format',
    id: 'number-format', 
    title: 'Number Format', submenu: [
      // 'general', 'percent', 'accounting', 'currency', 'scientific',
    ],
  },

  { type: 'separator' },

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


export const CreateToolbarTemplate = (options: ToolbarOptions): ToolbarItem[] => {

  const template: Array<ToolbarItem | ToolbarItem[]> = [];

  if (options.file_menu) {
    for (const item of more_menu) {
      template.push(item);
    }
  }

  if (options.file_toolbar) {
    for (const item of file_menu) {
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
    if (item.id === 'structure' && options.add_delete_sheet) {
      const new_item = JSON.parse(JSON.stringify(item));
      new_item.title = 'Rows/Columns/Sheets';
      for (const subitem of sheet_structure_menu) {
        new_item.submenu?.push(subitem);
      }
      template.push(new_item);
    }
    else {
      template.push(item);
    }
  }

  return JSON.parse(JSON.stringify(template));

};


