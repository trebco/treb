import type { OneOrMany, TextElement, XsdBoolean } from "./util.js";
import type { Color } from "./sheetProperties.js";
import type { Extension, ExtensionList } from "./misc.js";
import type {
  ST_CfType,
  ST_ConditionalFormattingOperator,
  ST_TimePeriod,
  ST_DataValidationType,
  ST_DataValidationErrorStyle,
  ST_DataValidationOperator,
} from "./enums.js";

// --- Merge Cells ---

export interface MergeCell {
  $attributes?: {
    ref: string;
  };
}

export interface MergeCells {
  $attributes?: {
    count?: number;
  };
  mergeCell: OneOrMany<MergeCell>;
}

// --- Conditional Formatting ---

export interface ConditionalFormattingValueObject {
  $attributes?: {
    type: "num" | "percent" | "max" | "min" | "formula" | "percentile";
    val?: string;
    gte?: XsdBoolean;
  };
}

export interface ColorScale {
  cfvo: OneOrMany<ConditionalFormattingValueObject>;
  color: OneOrMany<Color>;
}

export interface DataBar {
  $attributes?: {
    minLength?: number;
    maxLength?: number;
    showValue?: XsdBoolean;
  };
  cfvo: OneOrMany<ConditionalFormattingValueObject>;
  color: Color;
}

export interface IconSet {
  $attributes?: {
    iconSet?: string;
    showValue?: XsdBoolean;
    percent?: XsdBoolean;
    reverse?: XsdBoolean;
  };
  cfvo: OneOrMany<ConditionalFormattingValueObject>;
}

export interface CfRule {
  $attributes?: {
    type: ST_CfType;
    priority: number;
    dxfId?: number;
    stopIfTrue?: XsdBoolean;
    aboveAverage?: XsdBoolean;
    percent?: XsdBoolean;
    bottom?: XsdBoolean;
    operator?: ST_ConditionalFormattingOperator;
    text?: string;
    timePeriod?: ST_TimePeriod;
    rank?: number;
    stdDev?: number;
    equalAverage?: XsdBoolean;
  };
  formula?: OneOrMany<TextElement>;
  colorScale?: ColorScale;
  dataBar?: DataBar;
  iconSet?: IconSet;
  extLst?: ExtensionList<CfRuleExtension>;
}

/** Extension linking a standard cfRule to its x14 counterpart by GUID. */
export interface CfRuleExtension extends Extension {
  id?: TextElement;
}

export interface ConditionalFormatting {
  $attributes?: {
    sqref: string;
    pivot?: XsdBoolean;
  };
  cfRule: OneOrMany<CfRule>;
}

// --- Data Validations ---

export interface DataValidation {
  $attributes?: {
    type?: ST_DataValidationType;
    errorStyle?: ST_DataValidationErrorStyle;
    operator?: ST_DataValidationOperator;
    allowBlank?: XsdBoolean;
    showDropDown?: XsdBoolean;
    showInputMessage?: XsdBoolean;
    showErrorMessage?: XsdBoolean;
    errorTitle?: string;
    error?: string;
    promptTitle?: string;
    prompt?: string;
    sqref: string;
    imeMode?: string;
  };
  formula1?: TextElement;
  formula2?: TextElement;
}

export interface DataValidations {
  $attributes?: {
    disablePrompts?: XsdBoolean;
    xWindow?: number;
    yWindow?: number;
    count?: number;
  };
  dataValidation: OneOrMany<DataValidation>;
}

// --- Auto Filter ---

export interface FilterColumn {
  $attributes?: {
    colId: number;
    hiddenButton?: XsdBoolean;
    showButton?: XsdBoolean;
  };
  filters?: Record<string, unknown>;
  customFilters?: Record<string, unknown>;
  top10?: Record<string, unknown>;
  dynamicFilter?: Record<string, unknown>;
  colorFilter?: Record<string, unknown>;
  iconFilter?: Record<string, unknown>;
}

export interface AutoFilter {
  $attributes?: {
    ref: string;
  };
  filterColumn?: OneOrMany<FilterColumn>;
  sortState?: SortState;
}

// --- Sort State ---

export interface SortCondition {
  $attributes?: {
    descending?: XsdBoolean;
    sortBy?: string;
    ref: string;
    customList?: string;
    dxfId?: number;
    iconSet?: string;
    iconId?: number;
  };
}

export interface SortState {
  $attributes?: {
    columnSort?: XsdBoolean;
    caseSensitive?: XsdBoolean;
    sortMethod?: string;
    ref: string;
  };
  sortCondition?: OneOrMany<SortCondition>;
}

// --- x14 Conditional Formatting (extension) ---

export interface X14ConditionalFormattingValueObject {
  $attributes?: {
    type: "autoMin" | "autoMax" | "min" | "max" | "percent" | "percentile" | "num" | "formula";
  };
  f?: TextElement;
}

export interface X14DataBar {
  $attributes?: {
    minLength?: number;
    maxLength?: number;
    border?: XsdBoolean;
    gradient?: XsdBoolean;
    direction?: "context" | "leftToRight" | "rightToLeft";
    negativeBarColorSameAsPositive?: XsdBoolean;
    negativeBarBorderColorSameAsPositive?: XsdBoolean;
    axisPosition?: "automatic" | "middle" | "none";
  };
  cfvo?: OneOrMany<X14ConditionalFormattingValueObject>;
  fillColor?: Color;
  borderColor?: Color;
  negativeFillColor?: Color;
  negativeBorderColor?: Color;
  axisColor?: Color;
}

export interface X14CfIcon {
  $attributes?: {
    iconSet: string;
    iconId: number;
  };
}

export interface X14IconSet {
  $attributes?: {
    iconSet?: string;
    showValue?: XsdBoolean;
    reverse?: XsdBoolean;
    custom?: XsdBoolean;
  };
  cfvo?: OneOrMany<X14ConditionalFormattingValueObject>;
  cfIcon?: OneOrMany<X14CfIcon>;
}

export interface X14CfRule {
  $attributes?: {
    type: ST_CfType | "dataBar" | "iconSet";
    priority?: number;
    id: string;
  };
  dataBar?: X14DataBar;
  iconSet?: X14IconSet;
  formula?: OneOrMany<TextElement>;
  colorScale?: Record<string, unknown>;
}

export interface X14ConditionalFormatting {
  cfRule?: OneOrMany<X14CfRule>;
  /** sqref from xm namespace — cell range this formatting applies to. */
  sqref?: TextElement;
}

export interface X14ConditionalFormattings {
  conditionalFormatting?: OneOrMany<X14ConditionalFormatting>;
}

// --- Hyperlinks ---

export interface Hyperlink {
  $attributes?: {
    ref: string;
    id?: string;
    location?: string;
    tooltip?: string;
    display?: string;
  };
}

export interface Hyperlinks {
  hyperlink: OneOrMany<Hyperlink>;
}
