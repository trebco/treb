/** Cell data type (§18.18.11) */
export type ST_CellType = "b" | "d" | "e" | "inlineStr" | "n" | "s" | "str";

/** Cell formula type (§18.18.6) */
export type ST_CellFormulaType = "normal" | "array" | "dataTable" | "shared";

/** Pane position (§18.18.52) */
export type ST_Pane = "bottomLeft" | "bottomRight" | "topLeft" | "topRight";

/** Pane state (§18.18.53) */
export type ST_PaneState = "frozen" | "frozenSplit" | "split";

/** Sheet view type (§18.18.69) */
export type ST_SheetViewType = "normal" | "pageBreakPreview" | "pageLayout";

/** Page orientation (§18.18.50) */
export type ST_Orientation = "default" | "portrait" | "landscape";

/** Page order (§18.18.51) */
export type ST_PageOrder = "downThenOver" | "overThenDown";

/** Cell comments print mode (§18.18.5) */
export type ST_CellComments = "none" | "asDisplayed" | "atEnd";

/** Print error display (§18.18.58) */
export type ST_PrintError = "displayed" | "blank" | "dash" | "NA";

/** Data validation type (§18.18.21) */
export type ST_DataValidationType =
  | "none"
  | "whole"
  | "decimal"
  | "list"
  | "date"
  | "time"
  | "textLength"
  | "custom";

/** Data validation error style (§18.18.18) */
export type ST_DataValidationErrorStyle = "stop" | "warning" | "information";

/** Data validation operator (§18.18.20) */
export type ST_DataValidationOperator =
  | "between"
  | "notBetween"
  | "equal"
  | "notEqual"
  | "lessThan"
  | "lessThanOrEqual"
  | "greaterThan"
  | "greaterThanOrEqual";

/** Conditional format type (§18.18.12) */
export type ST_CfType =
  | "expression"
  | "cellIs"
  | "colorScale"
  | "dataBar"
  | "iconSet"
  | "top10"
  | "uniqueValues"
  | "duplicateValues"
  | "containsText"
  | "notContainsText"
  | "beginsWith"
  | "endsWith"
  | "containsBlanks"
  | "notContainsBlanks"
  | "containsErrors"
  | "notContainsErrors"
  | "timePeriod"
  | "aboveAverage";

/** Conditional formatting operator (§18.18.15) */
export type ST_ConditionalFormattingOperator =
  | "lessThan"
  | "lessThanOrEqual"
  | "equal"
  | "notEqual"
  | "greaterThanOrEqual"
  | "greaterThan"
  | "between"
  | "notBetween"
  | "containsText"
  | "notContains"
  | "beginsWith"
  | "endsWith";

/** Time period for conditional formatting (§18.18.82) */
export type ST_TimePeriod =
  | "today"
  | "yesterday"
  | "tomorrow"
  | "last7Days"
  | "thisMonth"
  | "lastMonth"
  | "nextMonth"
  | "thisWeek"
  | "lastWeek"
  | "nextWeek";

/** Sparkline type (x14:type) */
export type ST_SparklineType = "line" | "column" | "stacked";

/** Border style (§18.18.3) */
export type ST_BorderStyle =
  | "none"
  | "thin"
  | "medium"
  | "dashed"
  | "dotted"
  | "thick"
  | "double"
  | "hair"
  | "mediumDashed"
  | "dashDot"
  | "mediumDashDot"
  | "dashDotDot"
  | "mediumDashDotDot"
  | "slantDashDot";

/** Horizontal alignment (§18.18.40) */
export type ST_HorizontalAlignment =
  | "general"
  | "left"
  | "center"
  | "right"
  | "fill"
  | "justify"
  | "centerContinuous"
  | "distributed";

/** Vertical alignment (§18.18.88) */
export type ST_VerticalAlignment =
  | "top"
  | "center"
  | "bottom"
  | "justify"
  | "distributed";

/** Pattern type (§18.18.55) */
export type ST_PatternType =
  | "none"
  | "solid"
  | "mediumGray"
  | "darkGray"
  | "lightGray"
  | "darkHorizontal"
  | "darkVertical"
  | "darkDown"
  | "darkUp"
  | "darkGrid"
  | "darkTrellis"
  | "lightHorizontal"
  | "lightVertical"
  | "lightDown"
  | "lightUp"
  | "lightGrid"
  | "lightTrellis"
  | "gray125"
  | "gray0625";

/** Underline values (§18.4.13) */
export type ST_UnderlineValues =
  | "single"
  | "double"
  | "singleAccounting"
  | "doubleAccounting"
  | "none";

/** Font scheme (§18.18.33) */
export type ST_FontScheme = "none" | "major" | "minor";

/** Gradient fill type (§18.18.37) */
export type ST_GradientType = "linear" | "path";
