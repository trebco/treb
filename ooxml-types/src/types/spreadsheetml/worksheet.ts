import type { OneOrMany } from "./util.js";
import type { SheetData } from "./sheetData.js";
import type { SheetViews } from "./sheetViews.js";
import type { Cols } from "./columns.js";
import type {
  SheetPr,
  SheetDimension,
  SheetFormatPr,
  SheetProtection,
} from "./sheetProperties.js";
import type {
  PageMargins,
  PageSetup,
  PrintOptions,
  HeaderFooter,
  PageBreak,
} from "./pageLayout.js";
import type {
  MergeCells,
  ConditionalFormatting,
  DataValidations,
  AutoFilter,
  SortState,
  Hyperlinks,
  X14ConditionalFormattings,
} from "./dataFeatures.js";
import type { Drawing, TableParts, Extension, ExtensionList } from "./misc.js";
import type { SparklineGroups } from "./sparkline.js";

export interface WorksheetExtension extends Extension {
  sparklineGroups?: SparklineGroups;
  conditionalFormattings?: X14ConditionalFormattings;
}

export interface Worksheet {
  sheetData: SheetData;

  sheetPr?: SheetPr;
  dimension?: SheetDimension;
  sheetViews?: SheetViews;
  sheetFormatPr?: SheetFormatPr;
  sheetProtection?: SheetProtection;
  autoFilter?: AutoFilter;
  sortState?: SortState;
  mergeCells?: MergeCells;
  dataValidations?: DataValidations;
  hyperlinks?: Hyperlinks;
  printOptions?: PrintOptions;
  pageMargins?: PageMargins;
  pageSetup?: PageSetup;
  headerFooter?: HeaderFooter;
  rowBreaks?: PageBreak;
  colBreaks?: PageBreak;
  drawing?: Drawing;
  tableParts?: TableParts;
  extLst?: ExtensionList<WorksheetExtension>;

  cols?: OneOrMany<Cols>;
  conditionalFormatting?: OneOrMany<ConditionalFormatting>;
}
