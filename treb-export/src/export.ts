
import * as JSZip from 'jszip';
import { template } from './base-template';
import { Base64 as JSBase64 } from 'js-base64';
import { Workbook } from './workbook';

import { Style, Area, ICellAddress, Cell, Cells } from 'treb-base-types';
import { StyleOptions, Font, BorderStyle, Fill } from './style';
import { Parser, ArgumentSeparatorType, DecimalMarkType } from 'treb-parser';
import { NumberFormatCache } from 'treb-format';

import { SerializedSheet } from 'treb-grid';

/** excel units */
const one_hundred_pixels = 14.28515625;

/**
 * export treb sheets as xlsx files. we're starting simple.
 */
export class Exporter {

  // tslint:disable-next-line:variable-name
  public archive_!: JSZip;

  public workbook!: Workbook;

  public set zip(archive: JSZip) {
    this.archive_ = archive;
  }

  public get zip() {
    return this.archive_;
  }

  public async Init(zip?: JSZip) {

    if (!zip) {
      const data = JSBase64.decode(template);
      zip = await new JSZip().loadAsync(data as any);
    }
    this.archive_ = zip;

    this.workbook = new Workbook();
    await this.workbook.Init(zip);

  }

  /**
   * we're not including our sheet type because that's too deep in grid.
   * (FIXME: fix that).
   *
   * for the time being we are using the exported json, and we'll assume
   * a contract.
   * (FXIME: use an intermediate type)
   *
   * @param source
   */
  public async ExportSheet(source: {
      sheet_data: SerializedSheet[],
      decimal_mark: ','|'.',
    }) {

    this.workbook.InsertSheets(source.sheet_data.length);

    // we may need to rewrite functions
    let parser: Parser | undefined;

    if (source.decimal_mark === ',') {
      parser = new Parser();
      parser.decimal_mark = DecimalMarkType.Comma;
      parser.argument_separator = ArgumentSeparatorType.Semicolon;
    }

    for (let index = 0; index < source.sheet_data.length; index++) {

      const sheet = this.workbook.GetSheet(index);

      if (!sheet) {
        console.info('sheet not found @ index', index);
        continue;
      }

      const sheet_source = source.sheet_data[index];

      sheet.Parse();

      if (sheet_source.name) {
        this.workbook.RenameSheet(index, sheet_source.name);
      }

      // reset all merges, we will add as necessary
      sheet.ResetMerges();

      const style_map: Style.Properties[][] = [];
      if (sheet_source.cell_styles) {
        for (const cs of sheet_source.cell_styles) {
          const ref = sheet_source.cell_style_refs[cs.ref];
          if (!style_map[cs.column]) style_map[cs.column] = [];
          style_map[cs.column][cs.row] = ref;
        }
      }

      let last_column = -1;

      // console.info(JSON.stringify(sheet_source, undefined, 2));

      if (sheet_source.data) {

        const HandleCell = (cell: any) => {
          if (typeof cell.row === 'number' && typeof cell.column === 'number') {

            last_column = Math.max(last_column, cell.column);

            // FIXME: sheet style
            const list: Style.Properties[] = [];
            if (sheet_source.column_style && sheet_source.column_style[cell.column]) {
              list.push(sheet_source.column_style[cell.column]);
            }
            if (sheet_source.row_style && sheet_source.row_style[cell.row]) {
              list.push(sheet_source.row_style[cell.row]);
            }

            if (cell.style_ref) {
              const cs = sheet_source.cell_style_refs[cell.style_ref];
              list.push(cs);
            }
            else if (style_map[cell.column] && style_map[cell.column][cell.row]) {
              list.push(style_map[cell.column][cell.row]);
            }

            const composite = Style.Composite(list);
            for (const key of Object.keys(composite) as Style.PropertyKeys[]) {
              if (composite[key] === 'none') {
                delete composite[key];
              }
            }

            const font: Font = {};
            const fill: Fill = {};
            const border: BorderStyle = {};
            const options: StyleOptions = {
              font, border,
            };

            if (composite.number_format) {

              // we have some symbolic number formats that we'll need to
              // translate. these are defined by the cache.

              options.number_format = { format: NumberFormatCache.Translate(composite.number_format) };
            }

            if (composite.font_bold) font.bold = true;
            if (composite.font_italic) font.italic = true;
            if (composite.font_underline) font.underline = true;
            if (composite.text_color && composite.text_color !== Style.DefaultProperties.text_color) {
              font.color_argb = composite.text_color;
            }

            if (composite.border_top) {
              border.top_color = 64;
              border.top_style = 'thin';
            }
            if (composite.border_bottom) {
              border.bottom_color = 64;
              if (composite.border_bottom > 1) {
                border.bottom_style = 'double';
              }
              else {
                border.bottom_style = 'thin';
              }
            }
            if (composite.border_left) {
              border.left_color = 64;
              border.left_style = 'thin';
            }
            if (composite.border_right) {
              border.right_color = 64;
              border.right_style = 'thin';
            }

            switch (composite.horizontal_align) {
              case Style.HorizontalAlign.Center:
                options.horizontal_alignment = 'center';
                break;
              case Style.HorizontalAlign.Left:
                options.horizontal_alignment = 'left';
                break;
              case Style.HorizontalAlign.Right:
                options.horizontal_alignment = 'right';
                break;
            }

            if (composite.background) {
              fill.color_argb = composite.background;
              options.fill = fill;
            }

            if (composite.wrap) {
              options.wrap = true;
            }

            const style = this.workbook.style_cache.EnsureStyle(options);
            const range_options: { [index: string]: any } = { style };

            if (cell.calculated) {
              range_options.precalc = cell.calculated; // .toString();
            }

            if (cell.area && cell.area.start.row === cell.row && cell.area.start.column === cell.column) {
              range_options.array = Area.CellAddressToLabel(cell.area.start) +
                ':' + Area.CellAddressToLabel(cell.area.end);
            }
            else if (cell.merge_area && cell.merge_area.start.row === cell.row &&
              cell.merge_area.start.column === cell.column) {
              sheet.AddMerge(Area.CellAddressToLabel(cell.merge_area.start) +
                ':' + Area.CellAddressToLabel(cell.merge_area.end));

              // you don't need the empty merge cells. the actual error was
              // the order of the mergeCells item.

              /*
              // add empty cells
              for (let column = cell.merge_area.start.column; column <= cell.merge_area.end.column; column++ ){
                for (let row = cell.merge_area.start.row; row <= cell.merge_area.end.row; row++ ){
                  console.info('setting merge', row, column);
                  sheet.SetRange({row: row + 1, col: column + 1}, undefined, {merge: true});
                }
              }
              */

            }

            if (parser && cell.value && typeof cell.value === 'string' && cell.value[0] === '=') {
              const result = parser.Parse(cell.value);
              if (result.expression) {
                const rewrite = parser.Render(result.expression, undefined, undefined,
                  DecimalMarkType.Period, ArgumentSeparatorType.Comma);
                cell.value = '=' + rewrite;
              }
            }

            sheet.SetRange({ row: cell.row + 1, col: cell.column + 1 }, cell.value, range_options);
          }
          else {
            // console.info("NO", cell);
          }
        };

        for (const block of sheet_source.data) {
          if (block.cells) {
            const row = block.row;
            const column = block.column;
            for (const cell of block.cells) {
              if (typeof cell.row === 'number') {
                cell.column = column;
              }
              else if (typeof cell.column === 'number') {
                cell.row = row;
              }
              HandleCell(cell);
            }
          }
          else {
            HandleCell(block);
          }
        }

      }

      if (last_column >= 0 && sheet_source.default_column_width) {
        console.info(sheet_source.default_column_width);
        const units = sheet_source.default_column_width / 100 * one_hundred_pixels;
        for (let i = 0; i <= last_column; i++) {
          sheet.SetColumnWidth(i + 1, units);
        }
      }

      if (sheet_source.column_width) {
        console.info(sheet_source.column_width);
        for (const key of Object.keys(sheet_source.column_width)) {

          const column_index = Number(key || 0);

          // our widths are in pixels
          const units = sheet_source.column_width[column_index] / 100 * one_hundred_pixels;
          sheet.SetColumnWidth(column_index + 1, units);
        }
      }

      const default_row_height = (sheet_source.default_row_height || 0);
      if (sheet_source.row_height) {
        for (const key of Object.keys(sheet_source.row_height)) {
          if (!isNaN(Number(key)) && sheet_source.row_height[Number(key)] !== default_row_height) {
            sheet.SetRowHeight(Number(key) + 1,
              sheet_source.row_height[Number(key)] * 3 / 4);
          }
        }
      }

    }

    await this.workbook.Finalize();
  }

  public async AsBinaryString(compression_level?: number) {
    const opts: { [index: string]: any } = { type: 'binarystring' };
    if (typeof compression_level !== 'undefined') {
      opts.compression = 'DEFLATE';
      opts.compression_level = compression_level;
    }
    const output = await this.archive_.generateAsync(opts);
    return output;
  }

  public async AsBlob(compression_level?: number) {
    const opts: { [index: string]: any } = { type: 'blob' };
    if (typeof compression_level !== 'undefined') {
      opts.compression = 'DEFLATE';
      opts.compression_level = compression_level;
    }
    const output = await this.archive_.generateAsync(opts);
    return output;
  }

}

