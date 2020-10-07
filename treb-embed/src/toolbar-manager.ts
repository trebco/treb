
import { Toolbar, ToolbarElement, ToolbarInputField, ToolbarElementType, ToolbarIconDefinition, ToolbarButton } from 'treb-toolbar';
import { NumberFormatCache } from 'treb-format';
import { symbol_defs, SymbolDef } from './generated/symbol-defs';
import { icons } from './generated/icons';
import { tmpl, NodeModel } from 'treb-utils';
import { Style } from 'treb-base-types';
import { GridSelection, BorderConstants } from 'treb-grid/src';
import { BaseOptions } from './options';
import { ExtendedTheme } from 'treb-grid/src/types/theme';

import '../style/new-toolbar.css';

const separator: ToolbarElement = { type: ToolbarElementType.separator };

/*
export type ExtendedToolbarElement = ToolbarElement & {
  update_style?: Style.Properties;
}
*/

export class ToolbarManager {

  public toolbar: Toolbar;

  public map: {[index: string]: ToolbarElement} = {};

  public foreground_color = 'red';
  public background_color = 'yellow';
  public border_color?: string;
  
  public note: NodeModel;

  /**
   * sheet menu is optionally added to the structure menu (add/delete row/column)
   */
  public sheet_menu: ToolbarElement[] = [
    separator,
    { type: ToolbarElementType.text, text: 'Insert Sheet', id: 'insert-sheet' },
    { type: ToolbarElementType.text, text: 'Delete Sheet', id: 'delete-sheet' },
  ];

  /**
   * chart menu is optionally added at the end of the toolbar
   */
  public chart_menu: ToolbarElement[] = [
    separator,
    {
      type: ToolbarElementType.button,
      icon: symbol_defs['column-chart'],
      title: 'Insert column chart',
      id: 'insert-chart',
      data: { annotation: 'Column.Chart' },
      list: [
        { type: ToolbarElementType.button, icon: symbol_defs['column-chart'], title: 'Insert column chart', data: { annotation: 'Column.Chart' } },
        { type: ToolbarElementType.button, icon: symbol_defs['donut-chart'], title: 'Insert donut chart', data: { annotation: 'Donut.Chart' } },
        { type: ToolbarElementType.button, icon: symbol_defs['bar-chart'], title: 'Insert bar chart', data: { annotation: 'Bar.Chart' } },
        { type: ToolbarElementType.button, icon: symbol_defs['line-chart'], title: 'Insert line chart', data: { annotation: 'Line.Chart' } },
        separator,
        { type: ToolbarElementType.button, icon: icons['material/outline/image-24px'], id: 'image', title: 'Insert image' },
      ],
    },
  ];

  /**
   * file menu is optionally added to the start of the toolbar
   */
  public file_menu: ToolbarElement[] = [
    { 
      type: ToolbarElementType.button, id: 'save', title: 'Save to desktop', icon: icons['material/outline/save_alt-24px'],
    },
    { 
      type: ToolbarElementType.button, id: 'load', title: 'Open desktop file', icon: icons['material/outline/folder-24px'],
    },
    { 
      type: ToolbarElementType.button, id: 'new', title: 'New file', icon: icons['material/outline/insert_drive_file-24px'],
    },

    separator,
  ];

  public elements: ToolbarElement[] = [

    { 
      id: 'align-left',
      type: ToolbarElementType.button, 
      title: 'Left-align text',
      icon: symbol_defs['align-left'], // CreateSVGFragment(symbol_defs['align-left']).icon,
      data: { style: { horizontal_align: Style.HorizontalAlign.Left }},
    },
    { 
      id: 'align-center',
      type: ToolbarElementType.button, 
      title: 'Center-align text',
      icon: symbol_defs['align-center'],
      data: { style: { horizontal_align: Style.HorizontalAlign.Center }},
    },
    { 
      id: 'align-right',
      type: ToolbarElementType.button, 
      title: 'Right-align text',
      icon: symbol_defs['align-right'],
      data: { style: { horizontal_align: Style.HorizontalAlign.Right }},
    },
    separator,
    { 
      id: 'align-top',
      type: ToolbarElementType.button, 
      title: 'Align to top',
      icon: symbol_defs['align-top'],
      data: { style: { vertical_align: Style.VerticalAlign.Top }},
    },
    { 
      id: 'align-middle',
      type: ToolbarElementType.button, 
      active: true, 
      title: 'Align to middle',
      icon: symbol_defs['align-middle'],
      data: { style: { vertical_align: Style.VerticalAlign.Middle }},
    },
    { 
      id: 'align-bottom',
      type: ToolbarElementType.button, 
      title: 'Align to bottom',
      icon: symbol_defs['align-bottom'],
      data: { style: { vertical_align: Style.VerticalAlign.Bottom }},
    },

    separator,
    { 
      id: 'wrap',
      title: 'Wrap text',
      type: ToolbarElementType.button, 
      icon: icons['material/outline/wrap_text-24px'],
      data: { style: { wrap: true, }},
    },
    { 
      id: 'note',
      title: 'Comment',
      dropdown: 'button-custom',
      type: ToolbarElementType.button, 
      icon: icons['material/outline/chat_bubble_outline-24px'],
    },
    separator,
    {
      type: ToolbarElementType.button,
      id: 'background-color',
      icon: this.ApplyIconColor(symbol_defs['fill-color'], this.background_color),
      title: 'Background color',
      dropdown: 'color',
    },
    {
      type: ToolbarElementType.button,
      id: 'text-color',
      icon: this.ApplyIconColor(symbol_defs['text-color'], this.foreground_color),
      title: 'Text color',
      dropdown: 'color',
    },
    {
      // this item is just for layout: we use it to show the border color 
      // chooser. it's not focusable so it should not affect tab navigation.

      type: ToolbarElementType.hidden,
      id: 'border-color-target',
      dropdown: 'color',
    },
    {
      type: ToolbarElementType.button,
      id: 'apply-border',
      title: 'Bottom border',
      icon: symbol_defs['border-bottom'],
      data: { border: BorderConstants.Bottom },
      list: [
        { type: ToolbarElementType.button, icon: symbol_defs['border-none'], title: 'Clear borders', data: { border: BorderConstants.None } },
        { type: ToolbarElementType.button, icon: symbol_defs['border-outside'], title: 'Outside border', data: { border: BorderConstants.Outside } },
        { type: ToolbarElementType.button, icon: symbol_defs['border-top'], title: 'Top border', data: { border: BorderConstants.Top } },
        { type: ToolbarElementType.button, icon: symbol_defs['border-bottom'], id: 'border-bottom', title: 'Bottom border', data: { border: BorderConstants.Bottom } },
        { type: ToolbarElementType.button, icon: symbol_defs['border-double-bottom'], title: 'Double bottom border', data: { border: BorderConstants.Bottom, width: 2 } },
        { type: ToolbarElementType.button, icon: symbol_defs['border-left'], title: 'Left border', data: { border: BorderConstants.Left } },
        { type: ToolbarElementType.button, icon: symbol_defs['border-right'], title: 'Right border', data: { border: BorderConstants.Right } },
        { type: ToolbarElementType.button, icon: symbol_defs['border-all'], title: 'All borders', data: { border: BorderConstants.All } },
        separator,
        { 
          type: ToolbarElementType.button, 
          icon: icons['material/outline/palette-24px'], 
          id: 'border-color', 
          title: 'Border color',
        },

      ]
    },
    separator,
    { 
      type: ToolbarElementType.button, 
      id: 'merge',
      title: 'Merge cells',
      icon: symbol_defs['merge-cells'],
      data: { merge: true },
    },
    { 
      type: ToolbarElementType.button, 
      icon: symbol_defs.crop,
      // title: 'Rows/columns/sheets',
      // title: 'Rows/columns',
      dropdown: 'button-list',
      id: 'structure',
      list: [
        { type: ToolbarElementType.text, text: 'Insert Row', id: 'insert-row' },
        { type: ToolbarElementType.text, text: 'Insert Column', id: 'insert-column' },
        { type: ToolbarElementType.text, text: 'Delete Row', id: 'delete-row' },
        { type: ToolbarElementType.text, text: 'Delete Column', id: 'delete-column' },
        /*
        separator,
        { type: 'text', text: 'Insert Sheet', id: 'insert-sheet' },
        { type: 'text', text: 'Delete Sheet', id: 'delete-sheet' },
        */
      ],
    },
    { 
      type: ToolbarElementType.button,
      icon: symbol_defs['snowflake'], 
      id: 'freeze', 
      title: 'Freeze panes',
      data: { freeze: true },
    },
    separator,
    {
      id: 'format',
      type: ToolbarElementType.input,
      text: 'General',
      list: [], 
    },
    separator,
    {
      type: ToolbarElementType.split,
      top: {
        type: ToolbarElementType.button,
        text: '0.0',
        id: 'decrease-precision',
        title: 'Decrease precision',
      },
      bottom: {
        type: ToolbarElementType.button,
        text: '0.00',
        id: 'increase-precision',
        title: 'Increase precision',
      }
    },

  ];

  private static pattern = false;

  private static EnsurePattern() {

    if (this.pattern) { return; }

    const svg = tmpl`
      <svg version='1.1' id='root' style='width: 0px; height: 0px; overflow: hidden;'>
        <pattern width='3' height='3' patternTransform='rotate(45 0 0)' patternUnits='userSpaceOnUse'>
          <line x1='1' y1='0' x2='1' y2='10' style='stroke-width: 2; stroke: #999'/>
        </pattern>
      </svg>
    `;
    
    (svg.root.firstChild as Element)?.setAttribute('id', 'hatch-pattern');
    document.body.appendChild(svg.root);

    this.pattern = true;

  }

  constructor(
    container: HTMLElement, 
    private theme: ExtendedTheme, 
    private options: BaseOptions = {}) {

    ToolbarManager.EnsurePattern();

    // map before options, we need some lookups
    this.MapElements();
   
    this.note = tmpl`
      <div id='root' class='note-editor'>
        <textarea id='text'></textarea>
        <div>
          <button id='update' title='Update comment'>${Toolbar.checkmark}</button>
          <button id='delete' title='Delete comment'>${Toolbar.trash}</button>
        </div>
      </div>
    `;

    (this.map.note as ToolbarButton).content = this.note.root;
    (this.map.note as ToolbarButton).show = () => {
      (this.note.text as HTMLTextAreaElement).focus();
    };
    
    this.note.root.addEventListener('click', (event) => {
      if (event.target === this.note.update) {
        this.toolbar.Publish({ id: 'update-note', value: (this.note.text as HTMLTextAreaElement).value || undefined})
      }
      else if (event.target === this.note.delete) {
        this.toolbar.Publish({ id: 'update-note' })
      }
    });
    this.note.root.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && event.ctrlKey) {
        event.stopPropagation();
        event.preventDefault();
        (this.note.update as HTMLButtonElement).click();
      }
    });

    if (options.add_tab) {
      const structure = this.map['structure'];
      
      structure.list?.push(...this.sheet_menu);
      structure.title = 'Rows/columns/sheets';
    }
    if (options.file_menu) {
      this.elements.unshift(...this.file_menu);
    }
    if (options.chart_menu) {
      this.elements.push(...this.chart_menu);
    }

    this.UpdateBorderIconColors(this.theme.border_color || '#454');

    // remap
    this.MapElements();


    this.toolbar = new Toolbar(container);

    this.toolbar.Subscribe(event => {

      let top: ToolbarElement|undefined;
      let element: ToolbarElement|undefined;

      if (event.id === 'border-color') {
        const target = this.toolbar.Item('border-color-target')?.node?.firstChild as HTMLElement;
        //if (target) {
        //  requestAnimationFrame(() => target.click());
        //}
        target?.click();
        return;
      }
      
      if (event.element && event.element.parent_id) {
        switch (event.element.parent_id) {
          case 'insert-chart':
            top = this.map['insert-chart'];
            element = event.element;
            break;
          case 'apply-border':
            if (event.element.id !== 'border-color') {
              top = this.map['apply-border'];
              element = event.element;
            }
            break;
        }
      }

      if (typeof event.color !== 'undefined' && event.related_id) {

        if (event.related_id === 'border-color-target') {
          this.border_color = event.color === 'none' ? undefined : event.color;

          // this one is handled a little differently, because
          // we want to apply to the whole list

          // ...

          // TODO: apply to current selection

          const mapped = this.map['border-color'];
          mapped.title = `Border color (${event.color === 'none' ? 'default' : event.color})`

          this.UpdateBorderIconColors(event.color === 'none' ? (this.theme.border_color || '#454') : event.color);
          this.Update();
          return;

        }
        else if (event.related_id === 'text-color') {
          this.foreground_color = event.color;
          const mapped = this.map[event.related_id] as ToolbarButton;
          mapped.title = `Text color (${event.color === 'none' ? 'default' : event.color})`
          if (mapped.icon) {
            mapped.icon = this.ApplyIconColor(mapped.icon, event.color === 'none' ? this.theme.cell_color || '#000' : event.color);
          }
          this.Update();
        }
        else if (event.related_id === 'background-color') {
          this.background_color = event.color;
          const mapped = this.map[event.related_id] as ToolbarButton;
          mapped.title = `Background color (${event.color})`
          if (mapped.icon) {
            mapped.icon = this.ApplyIconColor(mapped.icon, event.color === 'none' ? 'url(#hatch-pattern)' : event.color);
          }
          this.Update();
        }

      }

      if (top && element) {
        // top = {...top, ...element, id: top.id }

        top.related_id = element.id;
        top.data = element.data ? JSON.parse(JSON.stringify(element.data)) : undefined;
        top.title = element.title;
        if (top.type === ToolbarElementType.button && element.type === ToolbarElementType.button) {
          top.icon = element.icon;
        }
        this.Update();

      }

    });
  }

  public UpdateBorderIconColors(color: string) {
    const item = this.map['apply-border'] as ToolbarButton;
    if (item.icon) {
      item.icon = this.ApplyIconColor(item.icon, color);
    }
    if (item.list) {
      for (const entry of item.list as ToolbarButton[]) {
        if (entry.icon) {
          entry.icon = this.ApplyIconColor(entry.icon, color);
        }
      }
    }
  }

  public ApplyIconColor(icon: ToolbarIconDefinition, color?: string) {

    // TODO: blank

    const clone = JSON.parse(JSON.stringify(icon)) as ToolbarIconDefinition;

    if (!color) { color = ''; }

    for (const path of clone.paths || []) {
      if (path.classes) {
        let classes = path.classes;
        if (!Array.isArray(classes)) { 
          classes = [classes]; 
        }
        if (classes.some(test => test === 'target-fill')) {
          path.style = `fill: ${color};`;
        }
        if (classes.some(test => test === 'target-stroke')) {
          path.style = `stroke: ${color};`;
        }
      }
    }

    return clone;
  }


  public Update(): void {
    this.toolbar.Update(this.elements);
  }

  /**
   * NOTE: style is guaranteed to be empty if selection is empty, because we
   * don't set it; therefore you don't have to test for selection.empty.
   */
  public UpdateSelection(
      selection: GridSelection, 
      merged: boolean, 
      style: Style.Properties = {}, 
      note: string|undefined, 
      frozen: boolean, 
      update = true): void {

    // active state for align and wrap

    this.map['align-left'].active = style.horizontal_align === Style.HorizontalAlign.Left;
    this.map['align-center'].active = style.horizontal_align === Style.HorizontalAlign.Center;
    this.map['align-right'].active = style.horizontal_align === Style.HorizontalAlign.Right;

    this.map['align-top'].active = style.vertical_align === Style.VerticalAlign.Top;
    this.map['align-middle'].active = style.vertical_align === Style.VerticalAlign.Middle;
    this.map['align-bottom'].active = style.vertical_align === Style.VerticalAlign.Bottom;

    // for wrap, also add data so we know which way the command goes

    const wrap = this.map['wrap'];
    wrap.active = !!style.wrap;
    wrap.data = { style: { wrap: !style.wrap }};

    /*
    // apply double-bottom border if there's already a border

    const border_width = style.border_bottom === 1 ? 2 : 1;
    const border_bottom = this.map['border-bottom'];
    const apply_borders = this.map['apply-border'];

    border_bottom.data.width = border_width;
    if (border_bottom.data.border === apply_borders.data.border) {
      apply_borders.data.width = border_width;
    }
    */

    (this.note.text as HTMLTextAreaElement).value = note || '';

    // update freeze. this should not be here, because freeze is not related
    // to selection. but since we're updating anyway...

    const freeze = this.map['freeze'];
    if (freeze.active !== frozen) {
      freeze.active = frozen;
      freeze.title = frozen ? 'Unfreeze panes' : 'Freeze panes';
      freeze.data = { freeze: !frozen };
    }

    const format = style.number_format || '';
    const symbolic_name = NumberFormatCache.SymbolicName(format);

    (this.map['format'] as ToolbarInputField).text = symbolic_name || format;

    const merge = this.map.merge as ToolbarButton;
    if (merge && merged === merge.data.merge) { // should be inverted
      if (merged) {
        merge.title = 'Unmerge cells';
        merge.icon = symbol_defs['unmerge-cells'];
        merge.data.merge = false;

      }
      else {
        merge.title = 'Merge cells';
        merge.icon = symbol_defs['merge-cells'];
        merge.data.merge = true;
      }
    }

    if (update) {
      this.Update();
    }
  }

  public UpdateDocumentStyles(formats: string[], colors: string[], update = true): void {
    
    const format_element = this.map['format'];
    if (!format_element) { return; } // FIXME: throw

    const number_formats: string[] = [
        'General', 'Number', 'Integer', 'Percent', 'Accounting', 'Currency', 'Scientific',
    ];

    const date_formats: string[] = [
      'Timestamp', 'Long Date', 'Short Date',
    ];

    for (const format of formats) {
      if (NumberFormatCache.SymbolicName(NumberFormatCache.Translate(format))) { continue; }
      const instance = NumberFormatCache.Get(format);
      if (instance.date_format) {
        date_formats.push(format);
      }
      else {
        number_formats.push(format);
      }
    }

    // let index = 0;
    const string_to_element = (text: string): ToolbarElement => {
      return { 
        type: ToolbarElementType.text, 
        text, 
        data: { style: { number_format: text }},
      };
    };

    format_element.list = [
      // ...this.default_number_formats.map(string_to_element),
      ...number_formats.map(string_to_element),
      separator,
      // ...this.default_date_formats.map(string_to_element),
      ...date_formats.map(string_to_element),
    ];

    this.toolbar.UpdateColors(colors);

    if (update) {
      this.Update();
    }

  }

  public MapElements(list = this.elements): void {
    for (const element of list) {
      if (element.id) { 
        this.map[element.id] = element; 
      }
      if (element.list) {
        this.MapElements(element.list);
      }
    }
  }

}

