import type { OneOrMany } from "../spreadsheetml/util.js";

/** Common relationship types. Not exhaustive — Type fields accept any string. */
export type WellKnownRelationshipType =
  | "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
  | "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties"
  | "http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties"
  | "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"
  | "http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings"
  | "http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"
  | "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme"
  | "http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart"
  | "http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing"
  | "http://schemas.openxmlformats.org/officeDocument/2006/relationships/table"
  | "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments"
  | "http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing"
  | "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink"
  | "http://schemas.openxmlformats.org/officeDocument/2006/relationships/pivotTable"
  | "http://schemas.openxmlformats.org/officeDocument/2006/relationships/pivotCacheDefinition"
  | "http://schemas.openxmlformats.org/officeDocument/2006/relationships/externalLink"
  | "http://schemas.openxmlformats.org/officeDocument/2006/relationships/printerSettings"
  | "http://schemas.microsoft.com/office/2006/relationships/vbaProject"
  | "http://schemas.openxmlformats.org/officeDocument/2006/relationships/image"
  | "http://schemas.openxmlformats.org/officeDocument/2006/relationships/customXml";

export interface Relationship {
  $attributes?: {
    Id: string;
    Type: WellKnownRelationshipType | (string & {});
    Target: string;
    TargetMode?: "External" | "Internal";
  };
}

export interface Relationships {
  Relationship?: OneOrMany<Relationship>;
}
