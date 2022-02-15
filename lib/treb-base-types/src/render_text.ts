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

