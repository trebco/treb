import type { OneOrMany } from "../spreadsheetml/util.js";

// --- Colors ---

export interface SrgbClr {
  $attributes?: {
    val: string;
  };
}

export interface SysClr {
  $attributes?: {
    val: string;
    lastClr?: string;
  };
}

export interface ThemeColor {
  srgbClr?: SrgbClr;
  sysClr?: SysClr;
}

export interface ColorScheme {
  $attributes?: {
    name: string;
  };
  dk1: ThemeColor;
  lt1: ThemeColor;
  dk2: ThemeColor;
  lt2: ThemeColor;
  accent1: ThemeColor;
  accent2: ThemeColor;
  accent3: ThemeColor;
  accent4: ThemeColor;
  accent5: ThemeColor;
  accent6: ThemeColor;
  hlink: ThemeColor;
  folHlink: ThemeColor;
}

// --- Fonts ---

export interface ThemeFont {
  $attributes?: {
    typeface: string;
    panose?: string;
    pitchFamily?: number;
    charset?: number;
  };
}

export interface SupplementalFont {
  $attributes?: {
    script: string;
    typeface: string;
  };
}

export interface FontCollection {
  latin: ThemeFont;
  ea: ThemeFont;
  cs: ThemeFont;
  font?: OneOrMany<SupplementalFont>;
}

export interface FontScheme {
  $attributes?: {
    name: string;
  };
  majorFont: FontCollection;
  minorFont: FontCollection;
}

// --- Format Scheme (stubbed — deeply nested) ---

export interface FormatScheme {
  $attributes?: {
    name: string;
  };
  fillStyleLst?: Record<string, unknown>;
  lnStyleLst?: Record<string, unknown>;
  effectStyleLst?: Record<string, unknown>;
  bgFillStyleLst?: Record<string, unknown>;
}

// --- Theme Elements ---

export interface ThemeElements {
  clrScheme: ColorScheme;
  fontScheme: FontScheme;
  fmtScheme?: FormatScheme;
}

// --- Theme (root) ---

export interface Theme {
  $attributes?: {
    name?: string;
  };
  themeElements: ThemeElements;
  objectDefaults?: Record<string, unknown>;
  extraClrSchemeLst?: Record<string, unknown>;
  extLst?: Record<string, unknown>;
}
