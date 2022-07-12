/**
 * This file is part of TREB.
 * Copyright 2022 trebco, llc.
 * info@treb.app
 */

export enum TextPartFlag {

  /** just render */
  default = 0,

  /** not rendered, but included in layout (spacing) */
  hidden = 1,

  /** takes up all available space */
  padded = 2,

  /** date component, needs to be filled */
  date_component = 3,

  /** special flag for minutes (instead of months), which is contextual */
  date_component_minutes = 4,

  /** literal (@): reflect the original */
  literal = 5,

  /** formatting (e.g. [red]) */
  formatting = 6,

  /* * testing, for complex 
  italic = 7,
  */

}

export interface TextPart {
  text: string;
  flag?: TextPartFlag;
}
