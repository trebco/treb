import type { OneOrMany, TextElement, XsdBoolean } from "./util.js";
import type { ST_CellType, ST_CellFormulaType } from "./enums.js";
import type { Font } from "./styles.js";

export interface CellFormula extends TextElement {
  $attributes?: {
    t?: ST_CellFormulaType;
    ref?: string;
    si?: number;
    ca?: XsdBoolean;
    aca?: XsdBoolean;
    dt2D?: XsdBoolean;
    dtr1?: XsdBoolean;
    dtr2?: XsdBoolean;
    r1?: string;
    r2?: string;
    del1?: XsdBoolean;
    del2?: XsdBoolean;
    bx?: XsdBoolean;
  };
}

/** Run properties share the same structure as `Font` in styles. */
export type RunProperties = Font;

export interface RichTextRun {
  rPr?: RunProperties;
  t: TextElement;
}

export interface InlineString {
  t?: TextElement;
  r?: OneOrMany<RichTextRun>;
}

export interface Cell {
  $attributes?: {
    r?: string;
    s?: number;
    t?: ST_CellType;
    cm?: number;
    vm?: number;
    ph?: XsdBoolean;
  };
  f?: CellFormula;
  v?: TextElement;
  is?: InlineString;
}

export interface Row {
  $attributes?: {
    r?: number;
    spans?: string;
    s?: number;
    customFormat?: XsdBoolean;
    ht?: number;
    hidden?: XsdBoolean;
    customHeight?: XsdBoolean;
    outlineLevel?: number;
    collapsed?: XsdBoolean;
    thickTop?: XsdBoolean;
    thickBot?: XsdBoolean;
    ph?: XsdBoolean;
  };
  c?: OneOrMany<Cell>;
}

export interface SheetData {
  row?: OneOrMany<Row>;
}
