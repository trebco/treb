import type { OneOrMany } from "../spreadsheetml/util.js";

/** Common OOXML content types. Not exhaustive — ContentType fields accept any string. */
export type WellKnownContentType =
  // Package
  | "application/vnd.openxmlformats-package.relationships+xml"
  | "application/vnd.openxmlformats-package.core-properties+xml"
  // Workbook
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"
  | "application/vnd.ms-excel.sheet.macroEnabled.main+xml"
  // Worksheet
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"
  // Shared strings, styles, theme
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"
  | "application/vnd.openxmlformats-officedocument.theme+xml"
  // Tables, charts, drawings
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"
  | "application/vnd.openxmlformats-officedocument.drawingml.chart+xml"
  | "application/vnd.openxmlformats-officedocument.drawing+xml"
  // Comments, pivot
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotTable+xml"
  | "application/vnd.openxmlformats-officedocument.spreadsheetml.pivotCacheDefinition+xml"
  // Media defaults
  | "image/png"
  | "image/jpeg"
  | "image/gif"
  | "application/xml"
  | "application/vml";

export interface Default {
  $attributes?: {
    Extension: string;
    ContentType: WellKnownContentType | (string & {});
  };
}

export interface Override {
  $attributes?: {
    PartName: string;
    ContentType: WellKnownContentType | (string & {});
  };
}

export interface ContentTypes {
  Default?: OneOrMany<Default>;
  Override?: OneOrMany<Override>;
}
