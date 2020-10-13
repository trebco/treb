
import * as JSZip from 'jszip';
// import { template } from './base-template';
import { template } from './template-2';
import { Workbook } from './workbook';

import { Style, Area, IArea, DataValidation, ValidationType, 
         IsFlatDataArray, IsNestedRowArray, FlatCellData } from 'treb-base-types';
import { QuotedSheetNameRegex, Parser, ArgumentSeparatorType, DecimalMarkType, 
         UnitCall, UnitAddress, UnitRange, ExpressionUnit } from 'treb-parser';

import { SerializedSheet } from 'treb-grid';
import { RangeOptions } from './sheet';
import { TwoCellAnchor } from './drawing/drawing';
import { ChartOptions } from './drawing/chart';

/** excel units */
const one_hundred_pixels = 14.28515625;

/**
 * export treb sheets as xlsx files. we're starting simple.
 */
export class Exporter {

  // tslint:disable-next-line:variable-name
  public archive_!: JSZip;

  public workbook!: Workbook;

  /** we may need to rewrite functions */
  public parser = new Parser();

  public set zip(archive: JSZip) {
    this.archive_ = archive;
  }

  public get zip(): JSZip {
    return this.archive_;
  }

  public async Init(zip?: JSZip): Promise<void> {

    if (!zip) {
      zip = await new JSZip().loadAsync(template, {base64: true});
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
  public async ExportSheets(source: {
      sheet_data: SerializedSheet[];
      active_sheet?: number;
      named_ranges?: {[index: string]: IArea};
      decimal_mark: ','|'.';
    }): Promise <void> {

    this.workbook.InsertSheets(source.sheet_data.length);

    // we may need to rewrite functions
    // let parser: Parser | undefined;
    let change_number_format = false;

    if (source.decimal_mark === ',') {
      // parser = new Parser();
      this.parser.decimal_mark = DecimalMarkType.Comma;
      this.parser.argument_separator = ArgumentSeparatorType.Semicolon;
      change_number_format = true;
    }

    const name_map: string[] = [];

    for (let index = 0; index < source.sheet_data.length; index++) {

      const sheet = this.workbook.GetSheet(index);
      const validations: Array<{
        row: number;
        column: number;
        // validation: DataValidation;
        formula: string;
      }> = [];

      const sparklines: Array<{
        expression: UnitCall;
        row: number;
        column: number;
        reference: string;
      }> = [];

      if (!sheet) {
        console.info('sheet not found @ index', index);
        continue;
      }

      const sheet_source = source.sheet_data[index];

      sheet.Parse();

      name_map[sheet_source.id || 0] = sheet_source.name || `Sheet${index + 1}`;
      
      if (sheet_source.name) {
        this.workbook.RenameSheet(index, sheet_source.name);
      }

      if (source.active_sheet && sheet_source.id === source.active_sheet) {
        sheet.tab_selected = true;
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
      let last_row = -1;

      // console.info(JSON.stringify(sheet_source, undefined, 2));

      if (sheet_source.data) {

        const StyleFromCell = (cell: { 
          row: number; 
          column: number;
          ref?: number;
          style_ref?: number;
         }) => {

          last_column = Math.max(last_column, cell.column);
          last_row = Math.max(last_row, cell.row);

          const list: Style.Properties[] = [sheet_source.sheet_style];

          if (sheet_source.row_pattern && sheet_source.row_pattern.length) {
            list.push(sheet_source.row_pattern[cell.row % sheet_source.row_pattern.length]);
          }

          if (sheet_source.column_style && sheet_source.column_style[cell.column]) {
            list.push(sheet_source.column_style[cell.column]);
          }

          if (sheet_source.row_style && sheet_source.row_style[cell.row]) {
            list.push(sheet_source.row_style[cell.row]);
          }

          if (cell.ref) {
            list.push(sheet_source.cell_style_refs[cell.ref]);
          }
          else if (cell.style_ref) {
            list.push(sheet_source.cell_style_refs[cell.style_ref]);
          }
          else if (style_map[cell.column] && style_map[cell.column][cell.row]) {
            list.push(style_map[cell.column][cell.row]);
          }

          const composite = Style.Composite(list);
          
          const options = this.workbook.style_cache.StyleOptionsFromProperties(composite);
          const style = this.workbook.style_cache.EnsureStyle(options);

          return style;

        };

        const HandleCell = (cell: FlatCellData) => {

          if (typeof cell.row === 'number' && typeof cell.column === 'number') {

            last_column = Math.max(last_column, cell.column);
            last_row = Math.max(last_row, cell.row);

            // const style = StyleFromCell(cell);

            const range_options: RangeOptions = {
              style: StyleFromCell(cell),
              precalc: cell.calculated,
            };

            /*
            // const range_options: { [index: string]: any } = { style };
            const range_options: RangeOptions = { style };

            if (cell.calculated !== undefined) {
              range_options.precalc = cell.calculated; // .toString();
            }
            */

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

            if (cell.validation) {
              const validation = cell.validation as DataValidation;
              let formula = '';

              if (validation.type === ValidationType.Range) {

                  // FIXME: sheet name
                 
                  const area = new Area({
                    ...validation.area.start,
                    absolute_column: true,
                    absolute_row: true,
                  }, {
                    ...validation.area.end,
                    absolute_column: true,
                    absolute_row: true,
                  });
        
                  // formula.text = '$D$3:$D$10';
                  formula = area.spreadsheet_label;

                  if (validation.area.start.sheet_id 
                      && validation.area.start.sheet_id !== sheet_source.id
                      && name_map[validation.area.start.sheet_id]) {
                    let sheet_name = name_map[validation.area.start.sheet_id];
                    if (QuotedSheetNameRegex.test(sheet_name)) {
                      sheet_name = `'${sheet_name}'`;
                    }
                    formula = sheet_name + '!' + formula;
                  }

                  console.info('f', formula);
                  
              }
              else if (validation.type === ValidationType.List) {
       
                const list = validation.list.filter(value => !!value).map((value) => {
                  return (value?.toString() || '').replace(/"/g, '""');
                }).join(', ');
      
                formula = '"' + list + '"';
        
              }

              if (formula) {              
                validations.push({
                  row: cell.row + 1,
                  column: cell.column + 1,
                  // validation: cell.validation
                  formula,
                });
              }

            }

            if (this.parser && cell.value && typeof cell.value === 'string' && cell.value[0] === '=') {
              const result = this.parser.Parse(cell.value);
              if (result.expression && result.expression.type === 'call') {
                switch (result.expression.name.toLowerCase()) {
                  case 'checkbox':
                    result.expression = result.expression.args[0];
                    cell.value = this.parser.Render(result.expression);
                    break;

                  case 'sparkline.column':
                  case 'sparkline.line':
                    cell.value = '';
                    sparklines.push({
                      expression: result.expression,
                      row: cell.row + 1, 
                      column: cell.column + 1,
                      reference: result.expression.args[0] ? this.parser.Render(result.expression.args[0]) : '',
                    });
                    break;
                }
              }

              // will this put the sparkline value back? (...)

              if (change_number_format) {
                if (result.expression) {
                  const rewrite = this.parser.Render(result.expression, undefined, undefined,
                    DecimalMarkType.Period, ArgumentSeparatorType.Comma);
                  cell.value = '=' + rewrite;
                }
              }
            }

            sheet.SetRange({ row: cell.row + 1, col: cell.column + 1 }, cell.value, range_options);
          }
          else {
            // console.info("NO", cell);
          }
        };

        // this is used for cells that have styling but no other data
        // (this changes? ... it changes when a cell is rendered and the style
        // is cached. that's bad.)

        // for the time being, set empty. if we hit the same cell later it
        // will overwrite. make sure we're padding columns here if necessary.

        for (const cell of sheet_source.cell_styles) {
          const style = StyleFromCell(cell);
          sheet.SetRange({ row: cell.row + 1, col: cell.column + 1 }, undefined, { style });
        }

        if (IsFlatDataArray(sheet_source.data)) {
          for (const cell of sheet_source.data) {
            HandleCell(cell);
          }
        }
        else if (IsNestedRowArray(sheet_source.data)) {
          for (const block of sheet_source.data) {
            for (const cell of block.cells) {
              HandleCell({...cell, row: block.row});
            }
          }
        }
        else {
          for (const block of sheet_source.data) {
            for (const cell of block.cells) {
              HandleCell({...cell, column: block.column});
            }
          }
        }

        /*
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
        */

      }

      if (last_column >= 0 && sheet_source.default_column_width) {
        //console.info(sheet_source.default_column_width);
        const units = sheet_source.default_column_width / 100 * one_hundred_pixels;
        for (let i = 0; i <= last_column; i++) {
          sheet.SetColumnWidth(i + 1, units);
        }
      }

      // style: row styles
      if (last_row >= 0) {
        const pattern_length = sheet_source.row_pattern?.length || 0;

        for (let i = 0; i <= last_row; i++) {

          const list: Style.Properties[] = [];

          if (pattern_length && sheet_source.row_pattern) {
            list.push(sheet_source.row_pattern[i % pattern_length]);
          }

          if (sheet_source.row_style && sheet_source.row_style[i]) {
            list.push(sheet_source.row_style[i]);
          }

          if (list.length) {
            const options = this.workbook.style_cache.StyleOptionsFromProperties(Style.Composite(list));
            const style = this.workbook.style_cache.EnsureStyle(options);
            sheet.SetRowStyleIndex(i + 1, style);
          }

        }
      }

      // style... page style and column style goes in columns
      {
        const base = sheet_source.sheet_style;
        let options = this.workbook.style_cache.StyleOptionsFromProperties(base);
        let style = this.workbook.style_cache.EnsureStyle(options);
        sheet.SetDefaultColumnStyle(style);

        if (last_column >= 0) {
          for (let i = 0; i <= last_column; i++) {
            const list = [base];
            if (sheet_source.column_style[i]) {
              list.push(sheet_source.column_style[i]);
            }
            options = this.workbook.style_cache.StyleOptionsFromProperties(Style.Composite(list));
            style = this.workbook.style_cache.EnsureStyle(options);

            if (style) {
              // console.info("COLUMN", i, "STYLE", style);
              sheet.SetColumnStyleIndex(i + 1, style);
            }

          }

        }
      }

      if (sheet_source.column_width) {
        // console.info(sheet_source.column_width);
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

      const parse_series = (arg: ExpressionUnit, options: ChartOptions) => {

        if (arg.type === 'range') {
          options.data.push(this.NormalizeAddress(arg, sheet_source));
        }
        else if (arg.type === 'call') {
          if (/group/i.test(arg.name)) {
            // recurse
            for (const value of (arg.args || [])) {
              parse_series(value, options);
            }
          }
          else if (/series/i.test(arg.name)) {

            const [label, x, y] = arg.args; // y is required
            
            if (y && y.type === 'range') {
              options.data.push(this.NormalizeAddress(y, sheet_source));

              if (label) {
                if (!options.names) { options.names = []; }

                if (label.type === 'address') {
                  this.NormalizeAddress(label, sheet_source);
                }
                
                if (label.type === 'range') {
                  this.NormalizeAddress(label.start, sheet_source);
                  options.names[options.data.length - 1] = label.start;
                }
                else {
                  options.names[options.data.length - 1] = label;
                }
                
              }

              if (!options.labels2) { options.labels2 = []; }
              if (x && x.type === 'range') {
                options.labels2[options.data.length - 1] = this.NormalizeAddress(x, sheet_source);
              }
            }
            else {
              console.info('invalid series missing Y')
            }

          }
        }

      };

      for (const annotation of sheet_source.annotations || []) {

        const parse_result = this.parser.Parse(annotation.formula || '');
        if (parse_result.expression && parse_result.expression.type === 'call') {
          
          let type = '';
          switch (parse_result.expression.name.toLowerCase()) {
            case 'line.chart':
              type = 'scatter';
              break;
            case 'scatter.line':
              type = 'scatter2';
              break;
            case 'donut.chart':
              type = 'donut';
              break;
            case 'bar.chart':
              type = 'bar';
              break;
            case 'column.chart':
              type = 'column';
              break;
          }

          if (type === 'column' || type === 'donut' || type === 'bar' || type === 'scatter' || type === 'scatter2') {

            const options: ChartOptions = { type, data: [] };

            const title_index = (type === 'scatter2') ? 1 : 2;
            const title_arg = parse_result.expression.args[title_index];

            if (title_arg && title_arg.type === 'literal') {
              options.title = title_arg;
            }
            else if (title_arg && title_arg.type === 'address') {
              options.title = this.NormalizeAddress(title_arg, sheet_source);
            }

            if (parse_result.expression.args[0]) {
              const arg0 = parse_result.expression.args[0];
              if (type === 'scatter2' || type === 'bar' || type === 'column') {
                parse_series(arg0, options);
              }
              else if (arg0.type === 'range') {
                options.data.push(this.NormalizeAddress(arg0, sheet_source));
              }
              else if (arg0.type === 'call' && /series/i.test(arg0.name)) {
                for (const series of arg0.args) {
                  if (series.type === 'range') {
                    options.data.push(this.NormalizeAddress(series, sheet_source));
                  }
                }
              }
            }

            if (type !== 'scatter2') {
              if (parse_result.expression.args[1] && parse_result.expression.args[1].type === 'range') {
                options.labels = this.NormalizeAddress(parse_result.expression.args[1], sheet_source);
              }
            }

            if (type === 'scatter' 
                && parse_result.expression.args[4]
                && parse_result.expression.args[4].type === 'literal'
                && parse_result.expression.args[4].value.toString().toLowerCase() === 'smooth') {

              options.smooth = true;
            }

            if (annotation.rect) {
              const anchor = this.AnnotationRectToAnchor(annotation.rect, sheet_source);
              sheet.AddChart(anchor, options);
            }

          }

        }
        

      }

      // const drawing_id = this.workbook.AddChart();
      // sheet.AddChartReference(drawing_id);

      if (validations.length) {
        sheet.AddValidations(validations);
      }

      if (sparklines.length) {
        sheet.AddSparklines(sparklines);
      }


    }

    if (source.named_ranges) {
      this.workbook.AddNamedRanges(source.named_ranges, name_map);
    }

    await this.workbook.Finalize();
  }

  /**
   * convert a rectangle (pixels) to a two-cell anchor. note that
   * our offsets are in pixels, they'll need to be changed to whatever
   * the target units are.
   */
  public AnnotationRectToAnchor(
      annotation_rect: { 
        left: number; 
        top: number; 
        width: number; 
        height: number; 
      }, 
      sheet: SerializedSheet): TwoCellAnchor {
    
    const anchor: TwoCellAnchor = {
      from: {row: -1, column: -1},
      to: {row: -1, column: -1},
    };

    const rect = {
      ...annotation_rect,  // {top, left, width, height}
      right: annotation_rect.left + annotation_rect.width,
      bottom: annotation_rect.top + annotation_rect.height,
    };
    
    for (let x = 0, column = 0; column < 1000; column++) {
      const width = (sheet.column_width && sheet.column_width[column]) ? sheet.column_width[column] : (sheet.default_column_width || 100);
      if (anchor.from.column < 0 && rect.left <= x + width) {
        anchor.from.column = column;
        anchor.from.column_offset = (rect.left - x);
      }
      if (anchor.to.column < 0 && rect.right <= x + width) {
        anchor.to.column = column;
        anchor.to.column_offset = (rect.right - x);
        break;
      }
      x += width;
    }

    for (let y = 0, row = 0; row < 1000; row++) {
      const height = (sheet.row_height && sheet.row_height[row]) ? sheet.row_height[row] : (sheet.default_row_height || 20);
      if (anchor.from.row < 0 && rect.top <= y + height) {
        anchor.from.row = row;
        anchor.from.row_offset = (rect.top - y);
      }
      if (anchor.to.row < 0 && rect.bottom <= y + height) {
        anchor.to.row = row;
        anchor.to.row_offset = (rect.bottom - y);
        break;
      }
      y += height;
    }

    return anchor;

  }

  /** overload for return type */
  public NormalizeAddress(unit: UnitAddress, sheet: SerializedSheet): UnitAddress;

  /** overload for return type */
  public NormalizeAddress(unit: UnitRange, sheet: SerializedSheet): UnitRange;

  /**
   * for charts we need addresses to be absolute ($)  and ensure there's
   * a sheet name -- use the active sheet if it's not explicitly referenced
   */
  public NormalizeAddress(unit: UnitAddress|UnitRange, sheet: SerializedSheet): UnitAddress|UnitRange {

    const addresses = (unit.type === 'address') ? [unit] : [unit.start, unit.end];

    for (const address of addresses) {
      address.absolute_row = true;
      address.absolute_column = true;
      if (!address.sheet) {
        address.sheet = sheet.name;
      }
    }
    if (unit.type === 'range') {
      unit.end.sheet = undefined;
    }

    unit.label = this.parser.Render(unit);
    return unit; // fluent

  }

  public async AsBinaryString(compression_level?: number) {
    const opts: JSZip.JSZipGeneratorOptions = { type: 'binarystring' };
    if (typeof compression_level !== 'undefined') {
      opts.compression = 'DEFLATE';
      opts.compressionOptions = {level: compression_level };
    }
    const output = await this.archive_.generateAsync(opts);
    return output;
  }

  public async AsBlob(compression_level?: number) {
    const opts: JSZip.JSZipGeneratorOptions = { type: 'blob' };
    if (typeof compression_level !== 'undefined') {
      opts.compression = 'DEFLATE';
      opts.compressionOptions = {level: compression_level };
    }
    const output = await this.archive_.generateAsync(opts);
    return output;
  }

}

