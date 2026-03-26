import type { OneOrMany, TextElement, XsdBoolean } from "../spreadsheetml/util.js";

// --- Anchor positioning ---

/** Column/row offset point used in `from` and `to` anchor elements. */
export interface AnchorPoint {
  col: TextElement;
  colOff: TextElement;
  row: TextElement;
  rowOff: TextElement;
}

/** Extent (width/height) for one-cell anchors. */
export interface Extent {
  $attributes?: {
    cx: number;
    cy: number;
  };
}

// --- Non-visual properties ---

export interface CNvPr {
  $attributes?: {
    id: number;
    name: string;
    descr?: string;
    title?: string;
    hidden?: XsdBoolean;
  };
}

export interface CNvGraphicFramePr {
  graphicFrameLocks?: Record<string, unknown>;
}

export interface NvGraphicFramePr {
  cNvPr: CNvPr;
  cNvGraphicFramePr?: CNvGraphicFramePr;
}

// --- Graphic frame ---

export interface GraphicData {
  $attributes?: {
    uri: string;
  };
  chart?: {
    $attributes?: {
      id: string;
    };
  };
}

export interface Graphic {
  graphicData: GraphicData;
}

export interface GraphicFrame {
  nvGraphicFramePr: NvGraphicFramePr;
  xfrm?: Record<string, unknown>;
  graphic: Graphic;
}

// --- Client data ---

export interface ClientData {
  $attributes?: {
    fLocksWithSheet?: XsdBoolean;
    fPrintsWithSheet?: XsdBoolean;
  };
}

// --- Anchors ---

export interface TwoCellAnchor {
  $attributes?: {
    editAs?: string;
  };
  from: AnchorPoint;
  to: AnchorPoint;
  graphicFrame?: GraphicFrame;
  sp?: Record<string, unknown>;
  pic?: Record<string, unknown>;
  cxnSp?: Record<string, unknown>;
  clientData?: ClientData;
}

export interface OneCellAnchor {
  from: AnchorPoint;
  ext: Extent;
  graphicFrame?: GraphicFrame;
  sp?: Record<string, unknown>;
  pic?: Record<string, unknown>;
  cxnSp?: Record<string, unknown>;
  clientData?: ClientData;
}

// --- Root ---

export interface SpreadsheetDrawing {
  twoCellAnchor?: OneOrMany<TwoCellAnchor>;
  oneCellAnchor?: OneOrMany<OneCellAnchor>;
  absoluteAnchor?: Record<string, unknown>;
}
