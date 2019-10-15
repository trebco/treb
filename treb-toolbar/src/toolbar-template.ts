
import { ToolbarItem } from './toolbar-item';
import { Localization } from 'treb-base-types';

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
]};

export const toolbar_template: Array<ToolbarItem|ToolbarItem[]> = [

  { icon: 'icon-format_align_left', id: 'align-left', title: 'Align Left' },
  { icon: 'icon-format_align_center', id: 'align-center', title: 'Align Center' },
  { icon: 'icon-format_align_right', id: 'align-right', title: 'Align Right' },

  { type: 'separator' },
  { icon: 'icon-vertical_align_top', id: 'align-top', title: 'Align Top' },
  { icon: 'icon-vertical_align_center', id: 'align-middle', title: 'Align Middle' },
  { icon: 'icon-vertical_align_bottom', id: 'align-bottom', title: 'Align Bottom' },


  { type: 'separator' },
  { icon: 'icon-wrap_text', id: 'wrap', title: 'Wrap Text'},
  { icon: 'icon-chat_bubble_outline', id: 'note', title: 'Add Note' },


  { type: 'separator' },
  { icon: 'icon-format_color_fill', color: true, id: 'fill-color', title: 'Background Color',
    'default-string': 'No fill'},
  { type: 'drop-down', 'related-id': 'fill-color', id: 'fill-color-dropdown' },
  { icon: 'icon-format_color_text', color: true, id: 'text-color', title: 'Text Color',
    'default-string': 'Default text color'},
  { type: 'drop-down', 'related-id': 'text-color', id: 'text-color-dropdown' },

  { icon: 'icon-border_bottom', id: 'border-option', title: 'Bottom Border',
     border: true, alternate_id: 'border-bottom' },
  { type: 'drop-down', 'related-id': 'border-option', id: 'border-dropdown' },

  { type: 'separator' },
  { icon: 'icon-fullscreen_exit', id: 'merge', title: 'Merge Cells' },
  { icon: 'icon-fullscreen', id: 'unmerge', title: 'Unmerge Cells' },
  { icon: 'icon-crop', id: 'structure', title: 'Grid Rows/Columns', submenu: [
    'insert row', 'insert column', 'delete row', 'delete column',
  ]},

  { icon: 'icon-ac_unit', id: 'freeze2', title: 'Freeze Panes' },

  /*
  { icon: 'icon-thermometer-0', id: 'freeze', title: 'Freeze Panes' },
  { icon: 'icon-thermometer', id: 'unfreeze', title: 'Unfreeze' },
  */

//  { type: 'separator' },

  { type: 'separator' },
  { type: 'input', text: '#', id: 'number-format', title: 'Number Format', submenu: [
    // 'general', 'percent', 'accounting', 'currency', 'scientific',
  ]},
  { type: 'split', submenu: [
    { id: 'decrease-decimal', text: `0${Localization.decimal_separator}0`, title: 'Decrease Precision' },
    { id: 'increase-decimal', text: `0${Localization.decimal_separator}00`, title: 'Increase Precision' },
  ]},

  /*
  { type: 'separator' },
  { icon: 'icon-border_clear', id: 'border-option', title: 'Clear Borders', border: true, alternate_id: 'border-none' },
  { type: 'drop-down', 'related-id': 'border-option', id: 'border-dropdown' },

  { icon: 'icon-border_outer', id: 'border-outer', title: 'Outer Border' },
  { icon: 'icon-border_bottom', id: 'border-bottom', title: 'Bottom Border' },
  { icon: 'icon-border_right', id: 'border-right', title: 'Right Border' },
  */

  /*
  { type: 'separator' },
  { icon: 'icon-delete', id: 'flush-simulation-results', title: 'Flush Simulation Results' },
  */

];
