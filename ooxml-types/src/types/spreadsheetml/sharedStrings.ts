import type { OneOrMany, TextElement } from "./util.js";
import type { RichTextRun } from "./sheetData.js";

export interface PhoneticRun {
  $attributes?: {
    sb: number;
    eb: number;
  };
  t: TextElement;
}

export interface PhoneticProperties {
  $attributes?: {
    fontId: number;
    type?: "halfwidthKatakana" | "fullwidthKatakana" | "Hiragana" | "noConversion";
    alignment?: "noControl" | "left" | "center" | "distributed";
  };
}

export interface StringItem {
  t?: TextElement;
  r?: OneOrMany<RichTextRun>;
  rPh?: OneOrMany<PhoneticRun>;
  phoneticPr?: PhoneticProperties;
}

export interface SharedStringTable {
  $attributes?: {
    count?: number;
    uniqueCount?: number;
  };
  si?: OneOrMany<StringItem>;
}
