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
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

/*
 * render text types moved from tile renderer in grid
 */

/**
 * information about a rendered substring. FIXME: move this somewhere else
 * 
 * FIXME: there's a lot of overlap between this and "TextPartFlag", which
 * comes from base types and is used by formatter. can we consolidate these?
 * 
 * testing some inline markdown...
 * FIXME: gate on option? sheet option? (...)
 * 
 */
export interface RenderTextPart {
  text: string;
  hidden: boolean;
  width: number;

  // italic?: boolean; // for imaginary // looks like crap

  // adding optional layout info (for hyperlink, basically)

  top?: number;
  left?: number;
  height?: number;

  // testing, md
  strong?: boolean;
  emphasis?: boolean;
  strike?: boolean;

}

export interface PreparedText {

  /**
   * strings now represents parts of individual lines; this both supports
   * MD and unifies the old system where it meant _either_ parts _or_ lines,
   * which was super confusing.
   */
  strings: RenderTextPart[][];

  /** this is the max rendered width. individual components have their own width */
  width: number;

  /** possibly override format; this is used for number formats that have [color] */
  format?: string;

}

