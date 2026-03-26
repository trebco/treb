import type { OneOrMany, XsdBoolean } from "./util.js";

export interface Col {
  $attributes?: {
    min: number;
    max: number;
    width?: number;
    style?: number;
    hidden?: XsdBoolean;
    bestFit?: XsdBoolean;
    customWidth?: XsdBoolean;
    outlineLevel?: number;
    collapsed?: XsdBoolean;
    phonetic?: XsdBoolean;
  };
}

export interface Cols {
  col: OneOrMany<Col>;
}
