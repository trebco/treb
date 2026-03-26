import type { OneOrMany, TextElement, XsdBoolean } from "../spreadsheetml/util.js";

// --- Data references ---

export interface NumericPoint {
  $attributes?: {
    idx: number;
    formatCode?: string;
  };
  v: TextElement;
}

export interface NumCache {
  formatCode?: TextElement;
  ptCount?: {
    $attributes?: { val: number };
  };
  pt?: OneOrMany<NumericPoint>;
}

export interface NumRef {
  f: TextElement;
  numCache?: NumCache;
}

export interface NumDataSource {
  numRef?: NumRef;
  numLit?: NumCache;
}

export interface StringPoint {
  $attributes?: {
    idx: number;
  };
  v: TextElement;
}

export interface StrCache {
  ptCount?: {
    $attributes?: { val: number };
  };
  pt?: OneOrMany<StringPoint>;
}

export interface StrRef {
  f: TextElement;
  strCache?: StrCache;
}

export interface StrDataSource {
  strRef?: StrRef;
}

// --- Series ---

export interface SeriesText {
  strRef?: StrRef;
  v?: TextElement;
}

export interface DataPoint {
  $attributes?: {};
  idx: { $attributes?: { val: number } };
  spPr?: Record<string, unknown>;
}

export interface DataLabels {
  numFmt?: Record<string, unknown>;
  spPr?: Record<string, unknown>;
  txPr?: Record<string, unknown>;
  showLegendKey?: { $attributes?: { val: XsdBoolean } };
  showVal?: { $attributes?: { val: XsdBoolean } };
  showCatName?: { $attributes?: { val: XsdBoolean } };
  showSerName?: { $attributes?: { val: XsdBoolean } };
  showPercent?: { $attributes?: { val: XsdBoolean } };
  showBubbleSize?: { $attributes?: { val: XsdBoolean } };
  extLst?: Record<string, unknown>;
}

export interface Marker {
  symbol?: { $attributes?: { val: string } };
  size?: { $attributes?: { val: number } };
  spPr?: Record<string, unknown>;
}

export interface ChartSeries {
  idx: { $attributes?: { val: number } };
  order: { $attributes?: { val: number } };
  tx?: SeriesText;
  spPr?: Record<string, unknown>;
  marker?: Marker;
  dPt?: OneOrMany<DataPoint>;
  dLbls?: DataLabels;
  cat?: StrDataSource | NumDataSource;
  val?: NumDataSource;
  xVal?: StrDataSource | NumDataSource;
  yVal?: NumDataSource;
  bubbleSize?: NumDataSource;
  smooth?: { $attributes?: { val: XsdBoolean } };
  explosion?: { $attributes?: { val: number } };
  extLst?: Record<string, unknown>;
}

// --- Chart types ---

export interface BarChart {
  barDir: { $attributes?: { val: string } };
  grouping: { $attributes?: { val: string } };
  varyColors?: { $attributes?: { val: XsdBoolean } };
  ser?: OneOrMany<ChartSeries>;
  dLbls?: DataLabels;
  gapWidth?: { $attributes?: { val: number } };
  overlap?: { $attributes?: { val: number } };
  axId: OneOrMany<{ $attributes?: { val: number } }>;
  extLst?: Record<string, unknown>;
}

export interface LineChart {
  grouping: { $attributes?: { val: string } };
  varyColors?: { $attributes?: { val: XsdBoolean } };
  ser?: OneOrMany<ChartSeries>;
  dLbls?: DataLabels;
  marker?: { $attributes?: { val: XsdBoolean } };
  smooth?: { $attributes?: { val: XsdBoolean } };
  axId: OneOrMany<{ $attributes?: { val: number } }>;
  extLst?: Record<string, unknown>;
}

export interface PieChart {
  varyColors?: { $attributes?: { val: XsdBoolean } };
  ser?: OneOrMany<ChartSeries>;
  dLbls?: DataLabels;
  firstSliceAng?: { $attributes?: { val: number } };
  extLst?: Record<string, unknown>;
}

export interface DoughnutChart {
  varyColors?: { $attributes?: { val: XsdBoolean } };
  ser?: OneOrMany<ChartSeries>;
  dLbls?: DataLabels;
  firstSliceAng?: { $attributes?: { val: number } };
  holeSize?: { $attributes?: { val: number } };
  extLst?: Record<string, unknown>;
}

export interface AreaChart {
  grouping: { $attributes?: { val: string } };
  varyColors?: { $attributes?: { val: XsdBoolean } };
  ser?: OneOrMany<ChartSeries>;
  dLbls?: DataLabels;
  axId: OneOrMany<{ $attributes?: { val: number } }>;
  extLst?: Record<string, unknown>;
}

export interface ScatterChart {
  scatterStyle: { $attributes?: { val: string } };
  varyColors?: { $attributes?: { val: XsdBoolean } };
  ser?: OneOrMany<ChartSeries>;
  dLbls?: DataLabels;
  axId: OneOrMany<{ $attributes?: { val: number } }>;
  extLst?: Record<string, unknown>;
}

export interface RadarChart {
  radarStyle: { $attributes?: { val: string } };
  varyColors?: { $attributes?: { val: XsdBoolean } };
  ser?: OneOrMany<ChartSeries>;
  dLbls?: DataLabels;
  axId: OneOrMany<{ $attributes?: { val: number } }>;
  extLst?: Record<string, unknown>;
}

// --- Axes ---

export interface Scaling {
  orientation: { $attributes?: { val: string } };
  max?: { $attributes?: { val: number } };
  min?: { $attributes?: { val: number } };
  logBase?: { $attributes?: { val: number } };
}

interface AxisBase {
  axId: { $attributes?: { val: number } };
  scaling: Scaling;
  delete?: { $attributes?: { val: XsdBoolean } };
  axPos: { $attributes?: { val: string } };
  title?: ChartTitle;
  numFmt?: Record<string, unknown>;
  majorTickMark?: { $attributes?: { val: string } };
  minorTickMark?: { $attributes?: { val: string } };
  tickLblPos?: { $attributes?: { val: string } };
  spPr?: Record<string, unknown>;
  txPr?: Record<string, unknown>;
  crossAx: { $attributes?: { val: number } };
  crosses?: { $attributes?: { val: string } };
  crossesAt?: { $attributes?: { val: number } };
  extLst?: Record<string, unknown>;
}

export interface CategoryAxis extends AxisBase {
  auto?: { $attributes?: { val: XsdBoolean } };
  lblAlgn?: { $attributes?: { val: string } };
  lblOffset?: { $attributes?: { val: number } };
  noMultiLvlLbl?: { $attributes?: { val: XsdBoolean } };
}

export interface ValueAxis extends AxisBase {
  crossBetween?: { $attributes?: { val: string } };
  majorUnit?: { $attributes?: { val: number } };
  minorUnit?: { $attributes?: { val: number } };
}

export interface DateAxis extends AxisBase {
  auto?: { $attributes?: { val: XsdBoolean } };
  lblOffset?: { $attributes?: { val: number } };
  baseTimeUnit?: { $attributes?: { val: string } };
  majorUnit?: { $attributes?: { val: number } };
  majorTimeUnit?: { $attributes?: { val: string } };
  minorUnit?: { $attributes?: { val: number } };
  minorTimeUnit?: { $attributes?: { val: string } };
}

export interface SeriesAxis extends AxisBase {}

// --- Title ---

export interface ChartTitle {
  tx?: {
    rich?: Record<string, unknown>;
    strRef?: StrRef;
  };
  layout?: Record<string, unknown>;
  overlay?: { $attributes?: { val: XsdBoolean } };
  spPr?: Record<string, unknown>;
  txPr?: Record<string, unknown>;
  extLst?: Record<string, unknown>;
}

// --- Legend ---

export interface LegendEntry {
  idx: { $attributes?: { val: number } };
  delete?: { $attributes?: { val: XsdBoolean } };
  txPr?: Record<string, unknown>;
  extLst?: Record<string, unknown>;
}

export interface Legend {
  legendPos?: { $attributes?: { val: string } };
  legendEntry?: OneOrMany<LegendEntry>;
  layout?: Record<string, unknown>;
  overlay?: { $attributes?: { val: XsdBoolean } };
  spPr?: Record<string, unknown>;
  txPr?: Record<string, unknown>;
  extLst?: Record<string, unknown>;
}

// --- Plot area ---

export interface PlotArea {
  layout?: Record<string, unknown>;
  barChart?: BarChart;
  bar3DChart?: Record<string, unknown>;
  lineChart?: LineChart;
  line3DChart?: Record<string, unknown>;
  pieChart?: PieChart;
  pie3DChart?: Record<string, unknown>;
  doughnutChart?: DoughnutChart;
  areaChart?: AreaChart;
  area3DChart?: Record<string, unknown>;
  scatterChart?: ScatterChart;
  radarChart?: RadarChart;
  bubbleChart?: Record<string, unknown>;
  stockChart?: Record<string, unknown>;
  surfaceChart?: Record<string, unknown>;
  surface3DChart?: Record<string, unknown>;
  ofPieChart?: Record<string, unknown>;
  catAx?: OneOrMany<CategoryAxis>;
  valAx?: OneOrMany<ValueAxis>;
  dateAx?: OneOrMany<DateAxis>;
  serAx?: OneOrMany<SeriesAxis>;
  spPr?: Record<string, unknown>;
  extLst?: Record<string, unknown>;
}

// --- Chart ---

export interface Chart {
  title?: ChartTitle;
  autoTitleDeleted?: { $attributes?: { val: XsdBoolean } };
  plotArea: PlotArea;
  legend?: Legend;
  plotVisOnly?: { $attributes?: { val: XsdBoolean } };
  dispBlanksAs?: TextElement;
  extLst?: Record<string, unknown>;
}

// --- Print settings ---

export interface PrintSettings {
  headerFooter?: Record<string, unknown>;
  pageMargins?: {
    $attributes?: {
      b: number;
      l: number;
      r: number;
      t: number;
      header: number;
      footer: number;
    };
  };
  pageSetup?: Record<string, unknown>;
}

// --- Chart space (root) ---

export interface ChartSpace {
  date1904?: { $attributes?: { val: XsdBoolean } };
  lang?: { $attributes?: { val: string } };
  roundedCorners?: { $attributes?: { val: XsdBoolean } };
  style?: { $attributes?: { val: number } };
  chart: Chart;
  spPr?: Record<string, unknown>;
  txPr?: Record<string, unknown>;
  printSettings?: PrintSettings;
  extLst?: Record<string, unknown>;
}
