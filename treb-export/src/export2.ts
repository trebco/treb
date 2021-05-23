
/**
 * rewrite of export. we'll still use a template, but do more direct
 * writing and less DOM manipulation. this should be cleaner in the long
 * run, but it will take a bit more work.
 */

import * as JSZip from 'jszip';
import * as he from 'he';

/** excel units (is this duplicated? move) */
const one_hundred_pixels = 14.28515625;

const XMLDeclaration = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n`;

import { template } from './template-2';
import { Workbook } from './workbook';
import { SerializedSheet } from 'treb-grid';

import { IArea, Area, ICellAddress, Cells, ValueType, CellValue, Style, DataValidation, ValidationType } from 'treb-base-types';
import { Parser } from 'treb-parser';

import * as xmlparser from 'fast-xml-parser';
import { SharedStrings } from './shared-strings2';
import { StyleCache, XlColor, BorderEdge } from './workbook-style2';
import { Theme } from './workbook-theme2';

import { Relationship, RelationshipMap, AddRel } from './relationship';

// FIXME: this came from workbook, unify
const XMLOptions2: Partial<xmlparser.X2jOptions> = {
  ignoreAttributes: false,
  attrNodeName: 'a$',
  attributeNamePrefix: '',
  textNodeName: 't$',
  trimValues: false,
  arrayMode: false,
};


export class Exporter {

  public zip?: JSZip;

  public xmloptions: Partial<xmlparser.J2xOptions> = {
    format: true,
    attrNodeName: 'a$',
    textNodeName: 't$',
    ignoreAttributes: false,
    supressEmptyNode: true,
    tagValueProcessor: a => (typeof a === 'string') ? he.encode(a, { useNamedReferences: true}) : a,
  };

  public xmlparser = new xmlparser.j2xParser(this.xmloptions);

  public parser = new Parser();

  constructor() {

  }

  public async Init() {
    this.zip = await new JSZip().loadAsync(template, {base64: true});

  }

  public async WriteRels(rels: RelationshipMap, path: string) {

    if (!this.zip) {
      throw new Error('missing zip');
    }

    const keys = Object.keys(rels);

    const dom = {
      Relationships: {
        a$: {
          xmlns: 'http://schemas.openxmlformats.org/package/2006/relationships',
        },
        Relationship: keys.map(key => {
          const rel = rels[key];
          const a$: any = {
            Id: rel.id,
            Target: rel.target,
            Type: rel.type,
          };
          if (rel.mode) {
            a$.TargetMode = rel.mode;
          }
          return { a$ };
        }),
      },
    };

    let xml = XMLDeclaration + this.xmlparser.parse(dom);
    // console.info(xml);
    await this.zip?.file(path, xml);

  }

  /**
   * format and write styles
   */
  public async WriteStyleCache(style_cache: StyleCache): Promise<void> {

    if (!this.zip) {
      throw new Error('missing zip');
    }

    const ColorAttributes = (color: XlColor) => {

      // we could just pass through except that we have argb and excel has rgb

      const attrs: any = {};
      if (color.indexed !== undefined) {
        attrs.indexed = color.indexed;
      }
      if (color.theme !== undefined) {
        attrs.theme = color.theme;
      }
      if (color.tint !== undefined) {
        attrs.tint = color.tint;
      }
      if (color.argb !== undefined) {
        attrs.rgb = color.argb;
      }
      return attrs;
    };

    const xfs = style_cache.cell_xfs.map(xf => {
      const block: any = {
        a$: {
          numFmtId: xf.number_format,
          fontId: xf.font,
          fillId: xf.fill,
          borderId: xf.border,
        },
      };

      if (xf.horizontal_alignment || xf.vertical_alignment || xf.wrap_text) {
        // block.a$.applyAlignment = 1;
        block.alignment = { a$: {}};
        if (xf.horizontal_alignment) {
          block.alignment.a$.horizontal = xf.horizontal_alignment;
        }
        if (xf.vertical_alignment) {
          block.alignment.a$.vertical = xf.vertical_alignment;
        }
        if (xf.wrap_text) {
          block.alignment.a$.wrapText = 1;
        }
      }

      return block;
    });

    const BorderColorAttributes = (edge: BorderEdge) => {
      if (edge.color) {
        return { indexed: edge.color };
      }
      if (edge.rgba) {
        return { rgb: edge.rgba };
      }
      if (edge.theme) {
        const attrs: any = {
          theme: edge.theme,
        }
        if (edge.tint) {
          attrs.tint = edge.tint;
        }
        return attrs;
      }
      return undefined;
    };

    const borders = style_cache.borders.map(border => {
      const block: any = {
        left: {},
        right: {},
        top: {},
        bottom: {},
        diagonal: {},
      };

      if (border.top.style) {
        block.top.a$ = {
          style: border.top.style,
        };
        const attrs = BorderColorAttributes(border.top);
        if (attrs) { block.top.color = {a$: attrs}; }
      }

      if (border.left.style) {
        block.left.a$ = {
          style: border.left.style,
        };
        const attrs = BorderColorAttributes(border.left);
        if (attrs) { block.left.color = {a$: attrs}; }
      }

      if (border.bottom.style) {
        block.bottom.a$ = {
          style: border.bottom.style,
        };
        const attrs = BorderColorAttributes(border.bottom);
        if (attrs) { block.bottom.color = {a$: attrs}; }
      }

      if (border.right.style) {
        block.right.a$ = {
          style: border.right.style,
        };
        const attrs = BorderColorAttributes(border.right);
        if (attrs) { block.right.color = {a$: attrs}; }
      }

      if (border.diagonal.style) {
        block.diagonal.a$ = {
          style: border.diagonal.style,
        };
        const attrs = BorderColorAttributes(border.diagonal);
        if (attrs) { block.diagonal.color = {a$: attrs}; }
      }

      return block;
    });

    // console.info("SC", style_cache);

    const fills = style_cache.fills.map(fill => {
      const block: any = {
        a$: { patternType: fill.pattern_type },
      };

      if (fill.pattern_gray !== undefined) {
        block.a$.patternType = `gray${fill.pattern_gray}`;
      }
      if (fill.bg_color) {
        block.bgColor = { a$: ColorAttributes(fill.bg_color) };
      }
      if (fill.fg_color) {
        block.fgColor = { a$: ColorAttributes(fill.fg_color) };
      }

      return {patternFill: block};
    });

    const fonts = style_cache.fonts.map(font => {
      const block: any = {};

      // flags

      if (font.bold) { block.b = ''; }
      if (font.italic) { block.i = ''; }
      if (font.underline) { block.u = ''; }
      if (font.strike) { block.strike = ''; }

      // "val" props

      if (font.size !== undefined) {
        block.sz = { a$: { val: font.size }};
      }
      if (font.family !== undefined) {
        block.family = { a$: { val: font.family }};
      }
      if (font.name !== undefined) {
        block.name = { a$: { val: font.name }};
      }
      if (font.scheme !== undefined) {
        block.scheme = { a$: { val: font.scheme }};
      }

      // color

      if (font.color_argb !== undefined) {
        block.color = { a$: { rgb: font.color_argb }};
      }
      else if (font.color_theme !== undefined) {
        block.color = { a$: { theme: font.color_theme }};
        if (font.color_tint) {
          block.color.a$.tint = font.color_tint;
        }
      }

      return block;
    });

    const dom: any = {
      styleSheet: {
        a$: {
          'xmlns':        'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
          'xmlns:mc':     'http://schemas.openxmlformats.org/markup-compatibility/2006',
          'mc:Ignorable': 'x14ac x16r2 xr',
          'xmlns:x14ac':  'http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac',
          'xmlns:x16r2':  'http://schemas.microsoft.com/office/spreadsheetml/2015/02/main', 
          'xmlns:xr':     'http://schemas.microsoft.com/office/spreadsheetml/2014/revision',
        },
        fonts: {
          a$: { count: fonts.length },
          font: fonts,
        },
        fills: {
          a$: { count: fills.length },
          fill: fills,
        },
        borders: {
          a$: { count: borders.length },
          border: borders,
        },
        /*
        cellStyleXfs: {
          xf: [],
        },
        */
        cellXfs: {
          a$: { count: xfs.length },
          xf: xfs,
        },
        /*
        cellStyles: {
          cellStyle: [],
        },
        dxfs: {

        },
        tableStyles: {

        },
        */
      },
    };

    let xml = XMLDeclaration + this.xmlparser.parse(dom);
    // console.info(xml);

    await this.zip?.file('xl/styles.xml', xml);

  }

  /**
   * format and write shared strings file to the zip archive. this will
   * replace any existing shared strings file.
   */
  public async WriteSharedStrings(shared_strings: SharedStrings): Promise<void> {

    if (!this.zip) {
      throw new Error('missing zip');
    }

    const dom: any = {
      sst: {
        a$: {
          'xmlns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
          count: shared_strings.strings.length,
          uniqueCount: shared_strings.strings.length,
        },
        si: [
          ...shared_strings.strings.map(t => { return {t}}),
        ],
      },
    };

    let xml = XMLDeclaration + this.xmlparser.parse(dom);
    await this.zip?.file('xl/sharedStrings.xml', xml);

  }

  /**
   * FIXME: merge with workbook function (put somewhere else)
   */
  public async ReadRels(zip?: JSZip, path = ''): Promise<RelationshipMap> {

    const rels: RelationshipMap = {};
    const data = await zip?.file(path)?.async('text') as string;
    //
    // force array on <Relationship/> elements, but be slack on the rest
    // (we know they are single elements)
    //
    const xml = xmlparser.parse(data || '', {
      ...XMLOptions2,
      arrayMode: /Relationship$/,
    });

    for (const relationship of xml.Relationships?.Relationship || []) {
      const id = relationship.a$.Id;
      rels[id] = {
        id, 
        type: relationship.a$.Type,
        target: relationship.a$.Target,
      };
    }

    return rels;

  }

  public StyleFromCell(sheet: SerializedSheet, style_cache: StyleCache, row: number, column: number, style: Style.Properties = {}) {

    const list: Style.Properties[] = [sheet.sheet_style];

    if (sheet.row_pattern && sheet.row_pattern.length) {
      list.push(sheet.row_pattern[row % sheet.row_pattern.length]);
    }

    // is this backwards, vis a vis our rendering? I think it might be...
    // YES: should be row pattern -> row -> column -> cell [corrected]

    if (sheet.row_style && sheet.row_style[row]) {
      list.push(sheet.row_style[row]);
    }

    if (sheet.column_style && sheet.column_style[column]) {
      list.push(sheet.column_style[column]);
    }

    /*
    if (cell.ref) {
      list.push(sheet_source.cell_style_refs[cell.ref]);
    }
    else if (cell.style_ref) {
      list.push(sheet_source.cell_style_refs[cell.style_ref]);
    }
    else if (style_map[cell.column] && style_map[cell.column][cell.row]) {
      list.push(style_map[cell.column][cell.row]);
    }
    */
    list.push(style);

    const options = style_cache.StyleOptionsFromProperties(Style.Composite(list));
    return style_cache.EnsureStyle(options);

  };

  public async Export(source: {
      sheet_data: SerializedSheet[];
      active_sheet?: number;
      named_ranges?: {[index: string]: IArea};
      decimal_mark: ','|'.';
    }) {
    // console.info('source', source);

    // --- create a map --------------------------------------------------------

    const sheet_name_map: string[] = [];
    for (const sheet of source.sheet_data) {
      const id = sheet.id || 0;
      if (id) {
        sheet_name_map[id] = sheet.name || '';
      }
    }

    // --- init workbook globals -----------------------------------------------

    // shared strings, start empty
    const shared_strings = new SharedStrings();

    // style and theme: use the template so we have the base values
    const style_cache = new StyleCache();
    const theme = new Theme();

    let data = await this.zip?.file('xl/theme/theme1.xml')?.async('text') as string;
    theme.FromXML(xmlparser.parse(data || '', XMLOptions2));

    data = await this.zip?.file('xl/styles.xml')?.async('text') as string;
    style_cache.FromXML(xmlparser.parse(data || '', XMLOptions2), theme);

    // --- now sheets ----------------------------------------------------------

    for (let sheet_index = 0; sheet_index < source.sheet_data.length; sheet_index++) {

      const sheet = source.sheet_data[sheet_index];
      const sheet_rels: RelationshipMap = {};
      
      // FIXME: we could, in theory, type this thing...

      const sheet_attributes = {
        'xmlns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
        'xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
        'xmlns:mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006',
        'mc:Ignorable': 'x14ac xr xr2 xr3',
        'xmlns:x14ac': 'http://schemas.microsoft.com/office/spreadsheetml/2009/9/ac',
        'xmlns:xr': 'http://schemas.microsoft.com/office/spreadsheetml/2014/revision', 
        'xmlns:xr2': 'http://schemas.microsoft.com/office/spreadsheetml/2015/revision2', 
        'xmlns:xr3': 'http://schemas.microsoft.com/office/spreadsheetml/2016/revision3',
        'xr:uid': '{D37933E2-499F-4789-8D13-194E11B743FC}',
      };

      const dom: any = {
        worksheet: {
          a$: {
            ...sheet_attributes,
          },
          dimension: {
            a$: {
              ref: 'A1',
            },
          },
          sheetViews: {
            sheetView: {
              a$: {
                tabSelected: 1,
                workbookViewId: 0,
              },
            },
          },
          sheetFormatPr: {
            a$: {
              defaultRowHeight: 15,
              'x14ac:dyDescent': 0.25,
            },
          },
          cols: {},
          sheetData: {},
          mergeCells: {
            a$: { count: 0 },
          },
          dataValidations: {},
          hyperlinks: {},
          pageMargins: {
            a$: {
              left: 0.7,
              right: 0.7,
              top: 0.75,
              bottom: 0.75,
              header: 0.3,
              footer: 0.3,
            },
          },
          // drawing: {},
          extLst: {
            ext: {
              a$: {
                uri: '{05C60535-1F16-4fd2-B633-F4F36F0B64E0}',
                'xmlns:x14': 'http://schemas.microsoft.com/office/spreadsheetml/2009/9/main',
              },
            },
          },

        },
      };

      /*
      const column_styles = (sheet.column_style as any) || {};

      for (const key of Object.keys(column_styles)) {
        console.info(key, '=>', column_styles[key]);

      }

      return;
      */

      // data has different representations. it is either blocked into rows or 
      // columns, or a set of individual cells. we could theoretically guarantee
      // a particular encoding if we wanted to (by row would be optimal for excel).

      // but we don't do that at the moment, so let's just unwind it using the 
      // standard class (adding support for cell styles)

      const cells = new Cells();
      cells.FromJSON(sheet.data, sheet.cell_style_refs);

      // these are cells with style but no contents

      for (const entry of sheet.cell_styles) {
        const cell = cells.EnsureCell(entry); // cheating
        if (!cell.style) {
          cell.style = sheet.cell_style_refs[entry.ref];
        }
      }

      // start with an extent from (0, 0). we can shift this as necessary.

      const extent: IArea = {
        start: { row: cells.rows + 1, column: cells.columns + 1, }, 
        end: { row: cells.rows + 1, column: cells.columns + 1, }};

      const FormulaText = (text: string) => (text[0] === '=') ? text.substr(1) : text;

      // cells data is row-major, and sparse.

      const sheet_data: any = { row: [] };

      const hyperlinks: Array<{
        rel: string,
        target: string,
        address: ICellAddress,
      }> = [];

      const sparklines: Array<{
        address: ICellAddress,
        formula: string,
        style?: Style.Properties,
      }> = [];

      const merges: Area[] = [];

      const validations: Array<{
        address: ICellAddress,
        validation: DataValidation,
      }> = [];

      // --



      // --

      for (let r = 0; r < cells.data.length; r++ ) {
        if (cells.data[r] && cells.data[r].length) {  

          // push out the extent (reversed)
          if (r < extent.start.row) {
            extent.start.row = r;
          }

          // row span
          const span = {start: -1, end: -1};
          const row: any = [];

          for (let c = 0; c < cells.data[r].length; c++) {
            const cell = cells.data[r][c];
            if (cell) {

              if (cell.merge_area && 
                  cell.merge_area.start.row === r &&
                  cell.merge_area.start.column === c) {
                merges.push(new Area(cell.merge_area.start, cell.merge_area.end));
              }

              if (cell.hyperlink) {
                const rel = AddRel(sheet_rels, 
                    'http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink', 
                    cell.hyperlink, 'External');
                hyperlinks.push({
                  rel, target: cell.hyperlink, address: {row: r, column: c}, 
                });
              }

              if (cell.validation && (cell.validation.type === ValidationType.List || cell.validation.type === ValidationType.Range)) {
                validations.push({
                  address: {row: r, column: c},
                  validation: cell.validation,
                });
              }

              // short-circuit here
              if (cell.type === ValueType.formula && /^=?sparkline\./i.test(cell.value as string)) {
                sparklines.push({
                  address: {row: r, column: c},
                  formula: cell.value as string,
                  style: cell.style,
                })
                continue;
              }

              // push out the extent (reversed)
              if (c < extent.start.column) {
                extent.start.column = c;
              }

              // update span: end is implicit
              if (span.start < 0) {
                span.start = c;
              }
              span.end = c;

              // we have to stack the styles? what if there's no cell style?
              // there are definitely column styles... 

              // s is style, index into the style table 
              let s: number|undefined = this.StyleFromCell(sheet, style_cache, r, c, cell.style);

              // v (child element) is the value
              let v: CellValue = undefined;
              let t: string|undefined;
              let f: any; // string|undefined;

              switch (cell.type) {
                case ValueType.formula:
                  f = FormulaText(cell.value as string);
                  switch (cell.calculated_type) {
                    case ValueType.string:
                      v = cell.calculated;
                      t = 'str';
                      break;

                    case ValueType.number:
                      v = cell.calculated;
                      break;

                    case ValueType.boolean:
                      v = (cell.calculated ? 1 : 0);
                      t = 'b';
                      break;
                  }
                  break;

                case ValueType.string:
                  v = shared_strings.Ensure(cell.value as string);
                  t = 's'; // shared string
                  break;

                case ValueType.number:
                  v = cell.value;
                  break;

                case ValueType.boolean:
                  v = (cell.value ? 1 : 0);
                  t = 'b';
                  break;

                //default:
                //  v = 0;
              }
              
              if (cell.area && cell.area.start.row === r && cell.area.start.column === c) {
                if (typeof f === 'string') {
                  console.info("ARRAY JEAD 2", cell.area);  
                  f = {
                    t$: f,
                    a$: {
                      t: 'array',
                      ref: cell.area.spreadsheet_label,
                    },
                  }
                }
              }

              // zerp
              const element: any = {
                a$: {
                  r: Area.CellAddressToLabel({row: r, column: c}),
                  // t,
                  // s,
                },
                // v,
              };

              if (t !== undefined) {
                element.a$.t = t;
              }
              if (s !== undefined) {
                element.a$.s = s;
              }
              if (f !== undefined) {
                element.f = f;              
              }
              if (v !== undefined) {
                element.v = v;
              }

              row.push(element);

            }
          }

          if (row.length) {
            const row_data: any = {
              a$: {
                r: r + 1,
                spans: `${span.start + 1}:${span.end + 1}`,
              },
              c: row,
            };
            if (sheet.row_height 
                && (typeof sheet.row_height[r] === 'number') 
                && sheet.row_height[r] !== sheet.default_row_height) {
              
              row_data.a$.customHeight = 1;
              row_data.a$.ht = sheet.row_height[r] * 3 / 4;
            }

            sheet_data.row.push(row_data);
          }

        }
      }

      // --- cols ----------------------------------------------------------------

      // the "cols" element represents column styles and nonstandard column 
      // widths. FIXME: should we put sheet style in here as well? I think so...

      const column_entries: Array<{
        style?: number;
        width?: number;
        index: number;
      }> = [];

      for (let c = 0; c < sheet.columns; c++) {
        const entry: { style?: number, width?: number, index: number } = { index: c };
        if (sheet.column_width 
            && sheet.default_column_width
            && (typeof sheet.column_width[c] === 'number')
            && sheet.column_width[c] !== sheet.default_column_width) {

          entry.width = sheet.column_width[c] * one_hundred_pixels / 100;
        }
        if (sheet.column_style[c]) {
          entry.style = style_cache.EnsureStyle(style_cache.StyleOptionsFromProperties(sheet.column_style[c]));
        }
        if (entry.style !== undefined || entry.width !== undefined) {
          column_entries[c] = entry;
        }
      }

      // we're short-cutting here, these should be arranged in blocks if
      // there's overlap. not sure how much of an issue that is though.
      
      if (column_entries.length) {
        for (const entry of column_entries) {
          dom.worksheet.cols.col = column_entries.map(entry => {
            const a$: any = { 
              min: entry.index + 1, 
              max: entry.index + 1,
            };
            if (entry.style !== undefined) {
              a$.style = entry.style;
            }
            if (entry.width !== undefined) {
              a$.width = entry.width;
              a$.customWidth = 1;
            }
            else {
              a$.width = (sheet.default_column_width || 100) / 100 * one_hundred_pixels;
            }
            return {a$};
          });
        }
      }
      else {
        delete dom.worksheet.cols;
      }

      // --- validation ----------------------------------------------------------

      if (validations.length) {

        dom.worksheet.dataValidations = {
          a$: { count: validations.length },
          dataValidation: validations.map(validation => {
            const entry: any = { 
              a$: {
                type: 'list',
                allowBlank: 1, 
                showInputMessage: 1, 
                showErrorMessage: 1, 
                sqref: new Area(validation.address).spreadsheet_label,
              },
            };
            if (validation.validation.type === ValidationType.Range) {
              const area = new Area(
                {...validation.validation.area.start, absolute_column: true, absolute_row: true}, 
                {...validation.validation.area.end, absolute_column: true, absolute_row: true},
              );
              entry.formula1 = `${area.spreadsheet_label}`;
            }
            else if (validation.validation.type === ValidationType.List) {
              entry.formula1 = `"${validation.validation.list.join(',')}"`;
            }
            return entry;
          }),
        };

      }
      else {
        delete dom.worksheet.dataValidations;
      }

      // --- merges --------------------------------------------------------------

      if (merges.length) {
        dom.worksheet.mergeCells.a$.count = merges.length;
        dom.worksheet.mergeCells.mergeCell = merges.map(merge => {
          return {
            a$: { ref: merge.spreadsheet_label }
          };
        });
      }
      else {
        delete dom.worksheet.mergeCells;
      }

      // --- hyperlinks ----------------------------------------------------------

      if (hyperlinks.length) {
        dom.worksheet.hyperlinks.hyperlink = hyperlinks.map(link => {
          return {
            a$: {
              'r:id': link.rel,
              ref: new Area(link.address).spreadsheet_label,
              'xr:uid': '{0C6B7792-7EA0-4932-BF15-D49C453C565D}',
            },
          };
        });
      }
      else {
        delete dom.worksheet.hyperlinks;
      }

      // --- sparklines ----------------------------------------------------------

      if (sparklines.length) {
        dom.worksheet.extLst.ext['x14:sparklineGroups'] = {
          a$: {
            'xmlns:xm': 'http://schemas.microsoft.com/office/excel/2006/main',
          },
          'x14:sparklineGroup': sparklines.map(sparkline => {

            const result = this.parser.Parse(sparkline.formula);
            let source = '';
            if (result.expression 
                && result.expression.type === 'call'
                && result.expression.args.length > 0) {
              const arg = result.expression.args[0];
              if (arg.type === 'range' || arg.type === 'address') {
                source = this.parser.Render(arg);
              }
            }

            const a$: any = {
              displayEmptyCellsAs: 'gap',
              // 'xr2:uid': '{CBFBAD21-B720-46A8-BBE7-649AAE7CB760}',
            };

            if (/column/i.test(sparkline.formula)) {
              a$.type = 'column';
            }

            return {
              a$,
              'x14:colorSeries': { a$: { rgb: 'FF376092' }},
              'x14:sparklines': {
                'x14:sparkline': {
                  'xm:f': source,
                  'xm:sqref': new Area(sparkline.address).spreadsheet_label,
                },
              },
            }
          }),
        };
      }
      else {
        delete dom.worksheet.extLst;
      }

      dom.worksheet.sheetData = sheet_data;

      // it seems like chrome, at least, will maintain order. but this is 
      // not gauranteed and we can't rely on it. the best thing to do might
      // be to use the renderer on blocks and then assemble the blocks ourselves.

      dom.worksheet.dimension.a$.ref = new Area(extent.start, extent.end).spreadsheet_label;
      const xml = XMLDeclaration + this.xmlparser.parse(dom);

      // write this into the file

      await this.zip?.file(`xl/worksheets/sheet${sheet_index + 1}.xml`, xml);
      if (Object.keys(sheet_rels).length) {
        this.WriteRels(sheet_rels, `xl/worksheets/_rels/sheet${sheet_index + 1}.xml.rels`);
      }

    }

    // these are workbook global so after all sheets are done

    await this.WriteSharedStrings(shared_strings);
    await this.WriteStyleCache(style_cache);

    // now have to write/update
    //
    // (1) contentTypes
    // (2) workbook.xml
    // (3) workbook.xml.rels
    //

    const workbook_rels: RelationshipMap = {};
    AddRel(workbook_rels, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles', 'styles.xml');
    AddRel(workbook_rels, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme', 'theme/theme1.xml');
    AddRel(workbook_rels, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings', 'sharedStrings.xml');

    const worksheet_rels_map = source.sheet_data.map((sheet, index) => AddRel(
      workbook_rels, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet',
      `worksheets/sheet${index + 1}.xml`,
    ));

    await this.WriteRels(workbook_rels, `xl/_rels/workbook.xml.rels`);

    const workbook_dom: any = {
      workbook: {
        a$: {
          'xmlns': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
          'xmlns:r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
          'xmlns:mc': 'http://schemas.openxmlformats.org/markup-compatibility/2006',
          'mc:Ignorable': 'x15 xr xr6 xr10 xr2',
          'xmlns:x15': 'http://schemas.microsoft.com/office/spreadsheetml/2010/11/main',
          'xmlns:xr': 'http://schemas.microsoft.com/office/spreadsheetml/2014/revision',
          'xmlns:xr6': 'http://schemas.microsoft.com/office/spreadsheetml/2016/revision6', 
          'xmlns:xr10': 'http://schemas.microsoft.com/office/spreadsheetml/2016/revision10', 
          'xmlns:xr2': 'http://schemas.microsoft.com/office/spreadsheetml/2015/revision2',
        },
        workbookPr: {
          a$: {
            defaultThemeVersion: '166925',
          },
        },
        sheets: {
          sheet: source.sheet_data.map((sheet, index) => {
            return {
              a$: {
                name: sheet.name || `Sheet${index + 1}`,
                sheetId: index + 1,
                'r:id': worksheet_rels_map[index],
              },
            };
          }),
        }
      },
    };

    const workbook_xml = XMLDeclaration + this.xmlparser.parse(workbook_dom);
    // console.info(workbook_xml);
    await this.zip?.file(`xl/workbook.xml`, workbook_xml);

    const content_types_dom: any = {
      Types: {
        a$: {
          'xmlns': 'http://schemas.openxmlformats.org/package/2006/content-types',
        },
        Default: [
          {a$: { Extension: 'rels', ContentType: 'application/vnd.openxmlformats-package.relationships+xml' }},
          {a$: { Extension: 'xml', ContentType: 'application/xml' }}
        ],
        Override: [
          { a$: { PartName: "/xl/workbook.xml", ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml" }},

          ...source.sheet_data.map((sheet, index) => {
            return { a$: {
                ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml",
                PartName: `/xl/worksheets/sheet${index + 1}.xml`,
            }};
          }),

          { a$: { PartName: "/xl/theme/theme1.xml", ContentType: "application/vnd.openxmlformats-officedocument.theme+xml" }},
          { a$: { PartName: "/xl/styles.xml", ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml" }},
          { a$: { PartName: "/xl/sharedStrings.xml", ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml" }},
          { a$: { PartName: "/docProps/core.xml", ContentType: "application/vnd.openxmlformats-package.core-properties+xml" }},
          { a$: { PartName: "/docProps/app.xml", ContentType: "application/vnd.openxmlformats-officedocument.extended-properties+xml" }},
        
        ],
      },
    };

    const content_types_xml = XMLDeclaration + this.xmlparser.parse(content_types_dom);
    // console.info(content_types_xml);
    await this.zip?.file(`[Content_Types].xml`, content_types_xml);

  }

  /** zip -> binary string */
  public async AsBinaryString(compression_level?: number) {
    if (!this.zip) {
      throw new Error('missing zip');
    }
    const opts: JSZip.JSZipGeneratorOptions = { type: 'binarystring' };
    if (typeof compression_level !== 'undefined') {
      opts.compression = 'DEFLATE';
      opts.compressionOptions = {level: compression_level };
    }
    const output = await this.zip.generateAsync(opts);
    return output;
  }

  /** zip -> blob */
  public async AsBlob(compression_level?: number) {
    if (!this.zip) {
      throw new Error('missing zip');
    }
    const opts: JSZip.JSZipGeneratorOptions = { type: 'blob' };
    if (typeof compression_level !== 'undefined') {
      opts.compression = 'DEFLATE';
      opts.compressionOptions = {level: compression_level };
    }
    const output = await this.zip.generateAsync(opts);
    return output;
  }

}