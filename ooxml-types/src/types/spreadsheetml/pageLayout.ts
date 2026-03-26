import type { OneOrMany, TextElement, XsdBoolean } from "./util.js";
import type {
  ST_Orientation,
  ST_PageOrder,
  ST_CellComments,
  ST_PrintError,
} from "./enums.js";

export interface PageMargins {
  $attributes?: {
    left: number;
    right: number;
    top: number;
    bottom: number;
    header: number;
    footer: number;
  };
}

export interface PageSetup {
  $attributes?: {
    paperSize?: number;
    scale?: number;
    firstPageNumber?: number;
    fitToWidth?: number;
    fitToHeight?: number;
    pageOrder?: ST_PageOrder;
    orientation?: ST_Orientation;
    usePrinterDefaults?: XsdBoolean;
    blackAndWhite?: XsdBoolean;
    draft?: XsdBoolean;
    cellComments?: ST_CellComments;
    useFirstPageNumber?: XsdBoolean;
    errors?: ST_PrintError;
    horizontalDpi?: number;
    verticalDpi?: number;
    copies?: number;
    id?: string;
  };
}

export interface PrintOptions {
  $attributes?: {
    horizontalCentered?: XsdBoolean;
    verticalCentered?: XsdBoolean;
    headings?: XsdBoolean;
    gridLines?: XsdBoolean;
    gridLinesSet?: XsdBoolean;
  };
}

export interface HeaderFooter {
  $attributes?: {
    differentOddEven?: XsdBoolean;
    differentFirst?: XsdBoolean;
    scaleWithDoc?: XsdBoolean;
    alignWithMargins?: XsdBoolean;
  };
  oddHeader?: TextElement;
  oddFooter?: TextElement;
  evenHeader?: TextElement;
  evenFooter?: TextElement;
  firstHeader?: TextElement;
  firstFooter?: TextElement;
}

export interface Break {
  $attributes?: {
    id?: number;
    min?: number;
    max?: number;
    man?: XsdBoolean;
    pt?: XsdBoolean;
  };
}

export interface PageBreak {
  $attributes?: {
    count?: number;
    manualBreakCount?: number;
  };
  brk?: OneOrMany<Break>;
}
