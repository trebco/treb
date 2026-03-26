import type { OneOrMany, TextElement, XsdBoolean } from "./util.js";
import type { ExtensionList } from "./misc.js";

export interface FileVersion {
  $attributes?: {
    appName?: string;
    lastEdited?: string;
    lowestEdited?: string;
    rupBuild?: string;
    codeName?: string;
  };
}

export interface WorkbookPr {
  $attributes?: {
    date1904?: XsdBoolean;
    showObjects?: "all" | "placeholders" | "none";
    showBorderUnselectedTables?: XsdBoolean;
    filterPrivacy?: XsdBoolean;
    promptedSolutions?: XsdBoolean;
    showInkAnnotation?: XsdBoolean;
    backupFile?: XsdBoolean;
    saveExternalLinkValues?: XsdBoolean;
    updateLinks?: "userSet" | "never" | "always";
    codeName?: string;
    hidePivotFieldList?: XsdBoolean;
    showPivotChartFilter?: XsdBoolean;
    allowRefreshQuery?: XsdBoolean;
    publishItems?: XsdBoolean;
    checkCompatibility?: XsdBoolean;
    autoCompressPictures?: XsdBoolean;
    refreshAllConnections?: XsdBoolean;
    defaultThemeVersion?: number;
  };
}

export interface WorkbookProtection {
  $attributes?: {
    workbookAlgorithmName?: string;
    workbookHashValue?: string;
    workbookSaltValue?: string;
    workbookSpinCount?: number;
    workbookPassword?: string;
    revisionsAlgorithmName?: string;
    revisionsHashValue?: string;
    revisionsSaltValue?: string;
    revisionsSpinCount?: number;
    revisionsPassword?: string;
    lockStructure?: XsdBoolean;
    lockWindows?: XsdBoolean;
    lockRevision?: XsdBoolean;
  };
}

export interface WorkbookView {
  $attributes?: {
    visibility?: "visible" | "hidden" | "veryHidden";
    minimized?: XsdBoolean;
    showHorizontalScroll?: XsdBoolean;
    showVerticalScroll?: XsdBoolean;
    showSheetTabs?: XsdBoolean;
    xWindow?: number;
    yWindow?: number;
    windowWidth?: number;
    windowHeight?: number;
    tabRatio?: number;
    firstSheet?: number;
    activeTab?: number;
    autoFilterDateGrouping?: XsdBoolean;
  };
}

export interface BookViews {
  workbookView: OneOrMany<WorkbookView>;
}

export interface Sheet {
  $attributes?: {
    name: string;
    sheetId: number;
    id: string;
    state?: "visible" | "hidden" | "veryHidden";
  };
}

export interface Sheets {
  sheet: OneOrMany<Sheet>;
}

export interface DefinedName extends TextElement {
  $attributes?: {
    name: string;
    comment?: string;
    customMenu?: string;
    description?: string;
    help?: string;
    statusBar?: string;
    localSheetId?: number;
    hidden?: XsdBoolean;
    function?: XsdBoolean;
    vbProcedure?: XsdBoolean;
    xlm?: XsdBoolean;
    functionGroupId?: number;
    shortcutKey?: string;
    publishToServer?: XsdBoolean;
    workbookParameter?: XsdBoolean;
  };
}

export interface DefinedNames {
  definedName: OneOrMany<DefinedName>;
}

export interface CalcPr {
  $attributes?: {
    calcId?: number;
    calcMode?: "manual" | "auto" | "autoNoTable";
    fullCalcOnLoad?: XsdBoolean;
    refMode?: "A1" | "R1C1";
    iterate?: XsdBoolean;
    iterateCount?: number;
    iterateDelta?: number;
    fullPrecision?: XsdBoolean;
    calcCompleted?: XsdBoolean;
    calcOnSave?: XsdBoolean;
    concurrentCalc?: XsdBoolean;
    concurrentManualCount?: number;
    forceFullCalc?: XsdBoolean;
  };
}

export interface PivotCache {
  $attributes?: {
    cacheId: number;
    id: string;
  };
}

export interface PivotCaches {
  pivotCache: OneOrMany<PivotCache>;
}

export interface ExternalReference {
  $attributes?: {
    id: string;
  };
}

export interface ExternalReferences {
  externalReference: OneOrMany<ExternalReference>;
}

export interface Workbook {
  sheets: Sheets;

  fileVersion?: FileVersion;
  workbookPr?: WorkbookPr;
  workbookProtection?: WorkbookProtection;
  bookViews?: BookViews;
  definedNames?: DefinedNames;
  calcPr?: CalcPr;
  pivotCaches?: PivotCaches;
  externalReferences?: ExternalReferences;
  extLst?: ExtensionList;
}
