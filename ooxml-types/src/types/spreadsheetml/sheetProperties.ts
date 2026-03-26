import type { XsdBoolean } from "./util.js";

export interface SheetDimension {
  $attributes?: {
    ref: string;
  };
}

export interface Color {
  $attributes?: {
    auto?: XsdBoolean;
    indexed?: number;
    rgb?: string;
    theme?: number;
    tint?: number;
  };
}

export interface SheetPr {
  $attributes?: {
    syncHorizontal?: XsdBoolean;
    syncVertical?: XsdBoolean;
    syncRef?: string;
    transitionEvaluation?: XsdBoolean;
    transitionEntry?: XsdBoolean;
    published?: XsdBoolean;
    codeName?: string;
    filterMode?: XsdBoolean;
    enableFormatConditionsCalculation?: XsdBoolean;
  };
  tabColor?: Color;
  outlinePr?: {
    $attributes?: {
      applyStyles?: XsdBoolean;
      summaryBelow?: XsdBoolean;
      summaryRight?: XsdBoolean;
      showOutlineSymbols?: XsdBoolean;
    };
  };
  pageSetUpPr?: {
    $attributes?: {
      autoPageBreaks?: XsdBoolean;
      fitToPage?: XsdBoolean;
    };
  };
}

export interface SheetFormatPr {
  $attributes?: {
    defaultRowHeight: number;
    baseColWidth?: number;
    defaultColWidth?: number;
    customHeight?: XsdBoolean;
    zeroHeight?: XsdBoolean;
    thickTop?: XsdBoolean;
    thickBottom?: XsdBoolean;
    outlineLevelRow?: number;
    outlineLevelCol?: number;
  };
}

export interface SheetProtection {
  $attributes?: {
    password?: string;
    algorithmName?: string;
    hashValue?: string;
    saltValue?: string;
    spinCount?: number;
    sheet?: XsdBoolean;
    objects?: XsdBoolean;
    scenarios?: XsdBoolean;
    formatCells?: XsdBoolean;
    formatColumns?: XsdBoolean;
    formatRows?: XsdBoolean;
    insertColumns?: XsdBoolean;
    insertRows?: XsdBoolean;
    insertHyperlinks?: XsdBoolean;
    deleteColumns?: XsdBoolean;
    deleteRows?: XsdBoolean;
    selectLockedCells?: XsdBoolean;
    sort?: XsdBoolean;
    autoFilter?: XsdBoolean;
    pivotTables?: XsdBoolean;
    selectUnlockedCells?: XsdBoolean;
  };
}
