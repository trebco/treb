/**
 * This file is part of TREB.
 * Copyright 2022 trebco, llc.
 * info@treb.app
 */

import type { TextPart } from 'treb-base-types';

/**
 * essentially number formats have a core section with the number
 * (possibly scaled), and some representation before and after.
 * exponential and percentage notation scale the number. exponential
 * is only allowed after the number. percent can come before or after.
 *
 * converting to class, default values
 * 
 * FIXME: this should be an interface, you can create a default instance
 * 
 */
export class NumberFormatSection {

  /** flag: this is a date format */
  public date_format = false;

  /** flag: this is the string section, don't format numbers */
  public string_format = false;

  /** flag: this is a fractional format */
  public fraction_format = false;

  /** flag: time in 12-hour format  */
  public twelve_hour = false;

  /** fraction: fixed denominator */
  public fraction_denominator = 0;

  /** fraction includes integer */
  public fraction_integer = true;

  /** align fraction digits (using ???) [TODO] */
  public fraction_align = 0;

  /** 
   * fraction denominator digits. we will limit to [1,4] but this can
   * be zero if there's an explicit denominator.
   */
  public fraction_denominator_digits = 0;

  /** prepend zeros */
  public integer_min_digits = 0;

  /** append zeros */
  public decimal_min_digits = 0;

  /** append decimal digits, but not trailing zeros */
  public decimal_max_digits = 0;

  /** use grouping (only supports groups of 3, no matter where you put the ,) */
  public grouping = false;

  /** this is a flag for switching whether we append strings to prefix or suffix */
  public has_number_format = false;

  /** leading string(s) */
  public prefix: TextPart[] = [{ text: '' }];

  /** trailing string(s) */
  public suffix: TextPart[] = [{ text: '' }];

  /**
   * thousands scaling (trailing commas in the number format section). we set
   * to zero for a faster flag if no scaling.
   */
  public scaling = 0;

  /** flag indicating percent -- will multiply value by 100 */
  public percent = false;

  /** flag indicating exponential -- turns numbers in to exp format */
  public exponential = false;

  /** this is a flag for testing -- we don't support multiple * in a format */
  public has_asterisk = false;

}
