import type { OneOrMany, XsdBoolean } from "./util.js";
import type { ST_Pane, ST_PaneState, ST_SheetViewType } from "./enums.js";

export interface Selection {
  $attributes?: {
    pane?: ST_Pane;
    activeCell?: string;
    activeCellId?: number;
    sqref?: string;
  };
}

export interface Pane {
  $attributes?: {
    xSplit?: number;
    ySplit?: number;
    topLeftCell?: string;
    activePane?: ST_Pane;
    state?: ST_PaneState;
  };
}

export interface SheetView {
  $attributes?: {
    windowProtection?: XsdBoolean;
    showFormulas?: XsdBoolean;
    showGridLines?: XsdBoolean;
    showRowColHeaders?: XsdBoolean;
    showZeros?: XsdBoolean;
    rightToLeft?: XsdBoolean;
    tabSelected?: XsdBoolean;
    showRuler?: XsdBoolean;
    showOutlineSymbols?: XsdBoolean;
    defaultGridColor?: XsdBoolean;
    showWhiteSpace?: XsdBoolean;
    view?: ST_SheetViewType;
    topLeftCell?: string;
    colorId?: number;
    zoomScale?: number;
    zoomScaleNormal?: number;
    zoomScaleSheetLayoutView?: number;
    zoomScalePageLayoutView?: number;
    workbookViewId: number;
  };
  pane?: Pane;
  selection?: OneOrMany<Selection>;
}

export interface SheetViews {
  sheetView: OneOrMany<SheetView>;
}
