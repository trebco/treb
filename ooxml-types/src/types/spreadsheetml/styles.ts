import type { OneOrMany, ValElement, XsdBoolean } from "./util.js";
import type { Color } from "./sheetProperties.js";
import type { ExtensionList } from "./misc.js";
import type {
  ST_BorderStyle,
  ST_HorizontalAlignment,
  ST_VerticalAlignment,
  ST_PatternType,
  ST_UnderlineValues,
  ST_FontScheme,
  ST_GradientType,
} from "./enums.js";

// --- Number Formats ---

export interface NumFmt {
  $attributes?: {
    numFmtId: number;
    formatCode: string;
  };
}

export interface NumFmts {
  $attributes?: {
    count?: number;
  };
  numFmt: OneOrMany<NumFmt>;
}

// --- Fonts ---

export interface Font {
  name?: ValElement;
  charset?: ValElement<number>;
  family?: ValElement<number>;
  b?: ValElement<boolean> | Record<string, never>;
  i?: ValElement<boolean> | Record<string, never>;
  strike?: ValElement<boolean> | Record<string, never>;
  outline?: ValElement<boolean> | Record<string, never>;
  shadow?: ValElement<boolean> | Record<string, never>;
  condense?: ValElement<boolean> | Record<string, never>;
  extend?: ValElement<boolean> | Record<string, never>;
  color?: Color;
  sz?: ValElement<number>;
  u?: ValElement<ST_UnderlineValues> | Record<string, never>;
  vertAlign?: ValElement<"superscript" | "subscript" | "baseline">;
  scheme?: ValElement<ST_FontScheme>;
}

export interface Fonts {
  $attributes?: {
    count?: number;
  };
  font: OneOrMany<Font>;
}

// --- Fills ---

export interface PatternFill {
  $attributes?: {
    patternType?: ST_PatternType;
  };
  fgColor?: Color;
  bgColor?: Color;
}

export interface GradientStop {
  $attributes?: {
    position: number;
  };
  color: Color;
}

export interface GradientFill {
  $attributes?: {
    type?: ST_GradientType;
    degree?: number;
    left?: number;
    right?: number;
    top?: number;
    bottom?: number;
  };
  stop: OneOrMany<GradientStop>;
}

export interface Fill {
  patternFill?: PatternFill;
  gradientFill?: GradientFill;
}

export interface Fills {
  $attributes?: {
    count?: number;
  };
  fill: OneOrMany<Fill>;
}

// --- Borders ---

export interface BorderEdge {
  $attributes?: {
    style?: ST_BorderStyle;
  };
  color?: Color;
}

export interface Border {
  $attributes?: {
    diagonalUp?: XsdBoolean;
    diagonalDown?: XsdBoolean;
    outline?: XsdBoolean;
  };
  left?: BorderEdge;
  right?: BorderEdge;
  top?: BorderEdge;
  bottom?: BorderEdge;
  diagonal?: BorderEdge;
  vertical?: BorderEdge;
  horizontal?: BorderEdge;
}

export interface Borders {
  $attributes?: {
    count?: number;
  };
  border: OneOrMany<Border>;
}

// --- Alignment & Protection ---

export interface Alignment {
  $attributes?: {
    horizontal?: ST_HorizontalAlignment;
    vertical?: ST_VerticalAlignment;
    textRotation?: number;
    wrapText?: XsdBoolean;
    indent?: number;
    relativeIndent?: number;
    justifyLastLine?: XsdBoolean;
    shrinkToFit?: XsdBoolean;
    readingOrder?: number;
  };
}

export interface CellProtection {
  $attributes?: {
    locked?: XsdBoolean;
    hidden?: XsdBoolean;
  };
}

// --- Cell Formats (xf) ---

export interface CellFormat {
  $attributes?: {
    numFmtId?: number;
    fontId?: number;
    fillId?: number;
    borderId?: number;
    xfId?: number;
    quotePrefix?: XsdBoolean;
    pivotButton?: XsdBoolean;
    applyNumberFormat?: XsdBoolean;
    applyFont?: XsdBoolean;
    applyFill?: XsdBoolean;
    applyBorder?: XsdBoolean;
    applyAlignment?: XsdBoolean;
    applyProtection?: XsdBoolean;
  };
  alignment?: Alignment;
  protection?: CellProtection;
}

export interface CellFormats {
  $attributes?: {
    count?: number;
  };
  xf: OneOrMany<CellFormat>;
}

// --- Cell Styles ---

export interface CellStyle {
  $attributes?: {
    name: string;
    xfId: number;
    builtinId?: number;
    iLevel?: number;
    hidden?: XsdBoolean;
    customBuiltin?: XsdBoolean;
  };
}

export interface CellStyles {
  $attributes?: {
    count?: number;
  };
  cellStyle: OneOrMany<CellStyle>;
}

// --- Differential Formats (for conditional formatting) ---

export interface DifferentialFormat {
  font?: Font;
  numFmt?: NumFmt;
  fill?: Fill;
  alignment?: Alignment;
  border?: Border;
  protection?: CellProtection;
}

export interface DifferentialFormats {
  $attributes?: {
    count?: number;
  };
  dxf?: OneOrMany<DifferentialFormat>;
}

// --- Table Styles ---

export interface TableStyle {
  $attributes?: {
    name: string;
    pivot?: XsdBoolean;
    table?: XsdBoolean;
    count?: number;
  };
}

export interface TableStyles {
  $attributes?: {
    count?: number;
    defaultTableStyle?: string;
    defaultPivotStyle?: string;
  };
  tableStyle?: OneOrMany<TableStyle>;
}

// --- Index Color Palette ---

export interface RgbColor {
  $attributes?: {
    rgb: string;
  };
}

export interface IndexedColors {
  rgbColor: OneOrMany<RgbColor>;
}

export interface MruColors {
  color: OneOrMany<Color>;
}

export interface Colors {
  indexedColors?: IndexedColors;
  mruColors?: MruColors;
}

// --- StyleSheet (root) ---

export interface StyleSheet {
  numFmts?: NumFmts;
  fonts?: Fonts;
  fills?: Fills;
  borders?: Borders;
  cellStyleXfs?: CellFormats;
  cellXfs?: CellFormats;
  cellStyles?: CellStyles;
  dxfs?: DifferentialFormats;
  tableStyles?: TableStyles;
  colors?: Colors;
  extLst?: ExtensionList;
}
