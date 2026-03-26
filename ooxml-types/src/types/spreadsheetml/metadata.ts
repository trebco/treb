import type { OneOrMany, XsdBoolean } from "./util.js";
import type { Extension, ExtensionList } from "./misc.js";

export interface MetadataType {
  $attributes?: {
    name: string;
    minSupportedVersion: number;
    ghostRow?: XsdBoolean;
    ghostCol?: XsdBoolean;
    edit?: XsdBoolean;
    delete?: XsdBoolean;
    copy?: XsdBoolean;
    pasteAll?: XsdBoolean;
    pasteFormulas?: XsdBoolean;
    pasteValues?: XsdBoolean;
    pasteFormats?: XsdBoolean;
    pasteComments?: XsdBoolean;
    pasteDataValidation?: XsdBoolean;
    pasteBorders?: XsdBoolean;
    pasteColWidths?: XsdBoolean;
    pasteNumberFormats?: XsdBoolean;
    merge?: XsdBoolean;
    splitFirst?: XsdBoolean;
    splitAll?: XsdBoolean;
    rowColShift?: XsdBoolean;
    clearAll?: XsdBoolean;
    clearFormats?: XsdBoolean;
    clearContents?: XsdBoolean;
    clearComments?: XsdBoolean;
    assign?: XsdBoolean;
    coerce?: XsdBoolean;
    adjust?: XsdBoolean;
    cellMeta?: XsdBoolean;
  };
}

export interface MetadataTypes {
  $attributes?: {
    count?: number;
  };
  metadataType: OneOrMany<MetadataType>;
}

export interface MetadataRecord {
  $attributes?: {
    t: number;
    v: number;
  };
}

export interface MetadataBlock {
  rc: OneOrMany<MetadataRecord>;
}

export interface MetadataBlocks {
  $attributes?: {
    count?: number;
  };
  bk: OneOrMany<MetadataBlock>;
}

export interface DynamicArrayProperties {
  $attributes?: {
    fDynamic?: XsdBoolean;
    fCollapsed?: XsdBoolean;
  };
}

export interface MetadataExtension extends Extension {
  dynamicArrayProperties?: DynamicArrayProperties;
}

export interface FutureMetadataBlock {
  extLst?: ExtensionList<MetadataExtension>;
}

export interface FutureMetadata {
  $attributes?: {
    name: string;
    count?: number;
  };
  bk?: OneOrMany<FutureMetadataBlock>;
}

export interface Metadata {
  metadataTypes?: MetadataTypes;
  futureMetadata?: OneOrMany<FutureMetadata>;
  cellMetadata?: MetadataBlocks;
  valueMetadata?: MetadataBlocks;
}
