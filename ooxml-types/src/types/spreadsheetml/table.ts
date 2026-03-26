import type { OneOrMany, XsdBoolean } from "./util.js";
import type { AutoFilter } from "./dataFeatures.js";
import type { ExtensionList } from "./misc.js";

// --- Table Columns ---

export interface TableColumn {
  $attributes?: {
    id: number;
    uniqueName?: string;
    name: string;
    totalsRowFunction?:
      | "none"
      | "sum"
      | "min"
      | "max"
      | "average"
      | "count"
      | "countNums"
      | "stdDev"
      | "var"
      | "custom";
    totalsRowLabel?: string;
    queryTableFieldId?: number;
    headerRowDxfId?: number;
    dataDxfId?: number;
    totalsRowDxfId?: number;
    headerRowCellStyle?: string;
    dataCellStyle?: string;
    totalsRowCellStyle?: string;
  };
  calculatedColumnFormula?: { $text?: string };
  totalsRowFormula?: { $text?: string };
  extLst?: ExtensionList;
}

export interface TableColumns {
  $attributes?: {
    count?: number;
  };
  tableColumn: OneOrMany<TableColumn>;
}

// --- Table Style Info ---

export interface TableStyleInfo {
  $attributes?: {
    name?: string;
    showFirstColumn?: XsdBoolean;
    showLastColumn?: XsdBoolean;
    showRowStripes?: XsdBoolean;
    showColumnStripes?: XsdBoolean;
  };
}

// --- Sort & Filter ---

export interface SortCondition {
  $attributes?: {
    descending?: XsdBoolean;
    ref: string;
  };
}

export interface SortState {
  $attributes?: {
    ref: string;
    columnSort?: XsdBoolean;
    caseSensitive?: XsdBoolean;
  };
  sortCondition?: OneOrMany<SortCondition>;
}

// --- Table (root) ---

export interface Table {
  $attributes?: {
    id: number;
    name: string;
    displayName: string;
    ref: string;
    tableType?: "worksheet" | "xml" | "queryTable";
    comment?: string;
    headerRowCount?: number;
    insertRow?: XsdBoolean;
    insertRowShift?: XsdBoolean;
    totalsRowCount?: number;
    totalsRowShown?: XsdBoolean;
    published?: XsdBoolean;
    headerRowDxfId?: number;
    dataDxfId?: number;
    totalsRowDxfId?: number;
    headerRowBorderDxfId?: number;
    tableBorderDxfId?: number;
    totalsRowBorderDxfId?: number;
    headerRowCellStyle?: string;
    dataCellStyle?: string;
    totalsRowCellStyle?: string;
    connectionId?: number;
  };
  autoFilter?: AutoFilter;
  sortState?: SortState;
  tableColumns: TableColumns;
  tableStyleInfo?: TableStyleInfo;
  extLst?: ExtensionList;
}
