
import { Toolbar, ToolbarElement, ToolbarInputField, ToolbarEvent, ToolbarIconDefinition, ToolbarButton } from 'treb-toolbar';
import { NumberFormatCache } from 'treb-format';
import { symbol_defs, SymbolDef } from './toolbar/symbol-defs';
import { icons } from './toolbar/icons';
import { tmpl } from 'treb-utils';
import { Style } from 'treb-base-types';
import { GridSelection, BorderConstants } from 'treb-grid/src';

const separator: ToolbarElement = { type: 'separator' };

export type ExtendedToolbarElement = ToolbarElement & {
  update_style?: Style.Properties;
}

export class ToolbarManager {

  public toolbar: Toolbar;

  public map: {[index: string]: ExtendedToolbarElement} = {};

  public foreground_color = 'red';
  public background_color = 'yellow';

  public elements: ExtendedToolbarElement[] = [
    { 
      id: 'align-left',
      type: 'button', 
      title: 'Left-align text',
      icon: symbol_defs['align-left'], // CreateSVGFragment(symbol_defs['align-left']).icon,
      update_style: { horizontal_align: Style.HorizontalAlign.Left },
    },
    { 
      id: 'align-center',
      type: 'button', 
      title: 'Center-align text',
      icon: symbol_defs['align-center'],
      update_style: { horizontal_align: Style.HorizontalAlign.Center },
    },
    { 
      id: 'align-right',
      type: 'button', 
      title: 'Right-align text',
      icon: symbol_defs['align-right'],
      update_style: { horizontal_align: Style.HorizontalAlign.Right },
    },
    separator,
    { 
      id: 'align-top',
      type: 'button', 
      title: 'Align to top',
      icon: symbol_defs['align-top'],
      update_style: { vertical_align: Style.VerticalAlign.Top },
    },
    { 
      id: 'align-middle',
      type: 'button', 
      active: true, 
      title: 'Align to middle',
      icon: symbol_defs['align-middle'],
      update_style: { vertical_align: Style.VerticalAlign.Middle },
    },
    { 
      id: 'align-bottom',
      type: 'button', 
      title: 'Align to bottom',
      icon: symbol_defs['align-bottom'],
      update_style: { vertical_align: Style.VerticalAlign.Bottom },
    },

    separator,
    { 
      id: 'wrap',
      title: 'Wrap text',
      type: 'button', 
      icon: icons['material/outline/wrap_text-24px'],
      update_style: { wrap: true },
    },
    { 
      id: 'comment',
      type: 'button', 
      icon: icons['material/outline/chat_bubble_outline-24px'],
    },
    separator,
    {
      type: 'button',
      id: 'text-color',
      icon: this.ApplyIconColor(symbol_defs['text-color'], this.foreground_color),
      title: 'Text Color',
      dropdown: 'color',
    },
    {
      type: 'button',
      id: 'background-color',
      icon: this.ApplyIconColor(symbol_defs['fill-color'], this.background_color),
      title: 'Background Color',
      dropdown: 'color',
    },
    {
      type: 'button',
      // id: 'border-bottom',
      id: 'apply-border',
      related_id: 'border-bottom',
      title: 'Bottom border',
      icon: symbol_defs['border-bottom'],
      dropdown: 'list',
      data: { border: BorderConstants.Bottom },
      list: [
        { type: 'button', icon: symbol_defs['border-none'], id: 'border-none', title: 'Clear borders', data: { border: BorderConstants.None } },
        { type: 'button', icon: symbol_defs['border-outside'], id: 'border-outer', title: 'Outside border', data: { border: BorderConstants.Outside } },
        { type: 'button', icon: symbol_defs['border-top'], id: 'border-top', title: 'Top border', data: { border: BorderConstants.Top } },
        { type: 'button', icon: symbol_defs['border-bottom'], id: 'border-bottom', title: 'Bottom border', data: { border: BorderConstants.Bottom } },
        { type: 'button', icon: symbol_defs['border-left'], id: 'border-left', title: 'Left border', data: { border: BorderConstants.Left } },
        { type: 'button', icon: symbol_defs['border-right'], id: 'border-right', title: 'Right border', data: { border: BorderConstants.Right } },
        { type: 'button', icon: symbol_defs['border-all'], id: 'border-all', title: 'All borders', data: { border: BorderConstants.All } },
        { type: 'separator', },
        { type: 'button', disabled: true, icon: icons['material/outline/palette-24px'], id: 'border-color', title: 'Border color' },

      ]
    },
    separator,
    { 
      type: 'button', 
      id: 'merge',
      title: 'Merge cells',
      icon: symbol_defs['merge-cells'],
      data: { merge: true },
    },
    { type: 'button', },
    { type: 'button', },
    separator,
    {
      id: 'format',
      type: 'input',
      text: 'General',
      dropdown: 'list',
      list: [] 
    },
    separator,
    {
      type: 'split',
      top: {
        type: 'button',
        text: '0.0',
        id: 'decrease-precision',
        title: 'Decrease precision',
      },
      bottom: {
        type: 'button',
        text: '0.00',
        id: 'increase-precision',
        title: 'Increase precision',
      }
    },
    separator,
    {
      type: 'button',
      id: 'insert-chart',
      related_id: 'column-chart',
      icon: symbol_defs['column-chart'],
      title: 'Insert column chart',
      dropdown: 'list',
      list: [
        { type: 'button', icon: symbol_defs['column-chart'], id: 'column-chart', title: 'Insert column chart' },
        { type: 'button', icon: symbol_defs['donut-chart'], id: 'donut-chart', title: 'Insert donut chart' },
        { type: 'button', icon: symbol_defs['bar-chart'], id: 'bar-chart', title: 'Insert bar chart' },
        { type: 'button', icon: symbol_defs['line-chart'], id: 'line-chart', title: 'Insert line chart' },
        separator,
        { type: 'button', icon: icons['material/outline/image-24px'], id: 'image', title: 'Insert image' },
      ],
    },

  ];

  public default_number_formats = [
    'General', 'Number', 'Integer', 'Percent', 'Accounting', 'Currency', 'Scientific'];

  public default_date_formats = [
    'Timestamp', 'Long Date', 'Short Date'];

  constructor(container: HTMLElement) {
    this.MapElements();
    this.toolbar = new Toolbar(container);

    this.toolbar.Subscribe(event => {

      let top: ExtendedToolbarElement|undefined;
      let element: ExtendedToolbarElement|undefined;

      if (event.id) {
        if (/-chart$/.test(event.id) || event.id === 'image') {
          top = this.map['insert-chart'];
          element = this.map[event.id];
        }
        else if (/^border-/.test(event.id) && event.id !== 'border-color') {
          top = this.map['apply-border'];
          element = this.map[event.id];
        }
      }

      if (typeof event.color !== 'undefined' && event.related_id) {

        if (event.related_id === 'text-color') {
          this.foreground_color = event.color;
        }
        else if (event.related_id === 'background-color') {
          this.background_color = event.color;
        }

        const mapped = this.map[event.related_id];
        if (mapped && mapped.type === 'button' && mapped.icon) {
          mapped.icon = this.ApplyIconColor(mapped.icon, event.color);
          this.Update();
        }
      }

      if (top && element) {
        // top = {...top, ...element, id: top.id }

        top.related_id = element.id;
        top.data = JSON.parse(JSON.stringify(element.data));
        top.title = element.title;
        if (top.type === 'button' && element.type === 'button') {
          top.icon = element.icon;
        }
        this.Update();

      }

    });
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
        if (classes.some(test => test === 'target')) {
          path.style = `fill: ${color};`;
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
  public UpdateSelection(selection: GridSelection, merged: boolean, style: Style.Properties = {}, note: boolean, update = true) {

    this.map['align-left'].active = style.horizontal_align === Style.HorizontalAlign.Left;
    this.map['align-center'].active = style.horizontal_align === Style.HorizontalAlign.Center;
    this.map['align-right'].active = style.horizontal_align === Style.HorizontalAlign.Right;

    this.map['align-top'].active = style.vertical_align === Style.VerticalAlign.Top;
    this.map['align-middle'].active = style.vertical_align === Style.VerticalAlign.Middle;
    this.map['align-bottom'].active = style.vertical_align === Style.VerticalAlign.Bottom;

    const wrap = this.map['wrap'];
    wrap.active = !!style.wrap;
    wrap.update_style = { wrap: !style.wrap };

    const border = this.map['apply-border'];
    const border_width = style.border_bottom === 1 ? 2 : 1;

    if (border) {
      if (border.related_id === 'border-bottom') {
        border.data.width = border_width;
      }
      for (const entry of border.list || []) {
        if (entry.id === 'border-bottom') {
          entry.data.width = border_width;
        }
      }
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

    const string_to_element = (entry: string): ToolbarElement => {
      return { type: 'text', text: entry };
    };

    const number_formats: string[] = [];
    const date_formats: string[] = [];

    for (const format of formats) {
      if (NumberFormatCache.SymbolicName(format)) { continue; }
      const instance = NumberFormatCache.Get(format);
      if (instance.date_format) {
        date_formats.push(format);
      }
      else {
        number_formats.push(format);
      }
    }

    format_element.list = [
      ...this.default_number_formats.map(string_to_element),
      ...number_formats.map(string_to_element),
      separator,
      ...this.default_date_formats.map(string_to_element),
      ...date_formats.map(string_to_element),
    ];

    this.toolbar.UpdateColors(colors);

    if (update) {
      this.Update();
    }

  }

  public MapElements(list = this.elements) {
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

