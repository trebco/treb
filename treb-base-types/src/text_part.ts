/*
 * This file is part of TREB.
 *
 * TREB is free software: you can redistribute it and/or modify it under the 
 * terms of the GNU General Public License as published by the Free Software 
 * Foundation, either version 3 of the License, or (at your option) any 
 * later version.
 *
 * TREB is distributed in the hope that it will be useful, but WITHOUT ANY 
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS 
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more 
 * details.
 *
 * You should have received a copy of the GNU General Public License along 
 * with TREB. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022-2024 trebco, llc. 
 * info@treb.app
 * 
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
