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
 * Copyright 2022-2026 trebco, llc. 
 * info@treb.app
 * 
 */

import { NumberFormat } from './format';

//
// rewriting format cache, to add some new behvior and clean up. this 
// version will be a plain module. that breaks the assumptions of some 
// clients, but they can continue to direct-import and use the old version.
// we'll add a warning.
//

/** 
 * cache of text -> format. can be symbolic names or format strings.
 */
const cache: Map<string, NumberFormat> = new Map();

/**
 * map of normalized symbolic name -> canonical symbolic name. 
 */
const normalized_name_map: Map<string, string> = new Map();

//
// init base formats
//

const base_formats = {
  Accounting: '_(#,##0.00_);(#,##0.00);-???',
  Number: '0.00',
  Integer: '0',
  Percent: '0.00%',
  General: '0.######', // for complex we will reduce the number of optional digits
  Fraction: '# ?/?',   // should that be "# #/#"? or does ? have a special meaning in fractions?
  Currency: '$* _(#,##0.00_);$* (#,##0.00);$* -???',
  Exponential: '0.000e',
  'Short Date': 'mm/dd/yy',
  'Long Date': 'dddd, mmm d yyyy',
  Timestamp: 'mm-dd-yy hh:mm:ss',
};

const aliases = {
  Scientific: 'Exponential',
  Percentage: 'Percent',
  Dollar: 'Currency',
};

/**
 * initialize cache, optionally with format overrides.
 * TODO: settle the list of names so we can use a type
 */
export function InitCache(overrides: Record<string, string> = {}) {

  for (const [name, format] of Object.entries(base_formats)) {
    const replacement = overrides[name];
    cache.set(name, new NumberFormat(replacement||format));
  }

  for (const [name, mapped] of Object.entries(aliases)) {
    const replacement = overrides[name];
    const target = cache.get(replacement||mapped);
    if (target) {
      cache.set(name, target);
    }
    else {
      cache.delete(name);
    }
  }

}

const complex_general = new NumberFormat('0.###');

/**
 * return number formatter for symbolic name or format string
 */
export function Get(format: string, complex = false): NumberFormat {

  const lc = format.toLowerCase();
  if (complex && lc === 'general') {
    return complex_general;
  }

  const mapped = normalized_name_map.get(lc);
  
  let formatter = cache.get(mapped||format);

  if (!formatter) {
    formatter = new NumberFormat(format);
    cache.set(format, formatter);
  }

  return formatter;

}

/**
 * this method is used to translate symbolic formats,
 * without actually creating a formatter. it's a shortcut
 * we need for exporting to xlsx.
 *
 * if the passed format matches a symbolic format, we return
 * the string representation. if it doesn't match any symbolic format,
 * the string is returned as-is.
 */
export function Translate(format: string): string {
  const mapped = normalized_name_map.get(format.toLowerCase());
  return mapped ? cache.get(mapped)?.toString() || format : format;
}

/**
 * check if the format (as a number format) matches a local 
 * symbolic name and if so, return that.
 * 
 * @returns symbolic name, or null; not sure why null instead
 * of undefined, but we're retaining null for backcompat purposes.
 */
export function SymbolicName(format: string): string|null {

  // format is a number format pattern, so match is case-sensitive

  for (const [key, value] of Object.entries(base_formats)) {
    if (format === value) {
      return key;
    }
  }

  return null;
}

/**
 * check equality. this can compare symbolic names to format strings.
 */
export function Equals(a: string, b: string) {
  if (a === b) {
    return true;
  }
  const fa = Get(a);
  const fb = Get(b);
  return fa.pattern === fb.pattern;
}

// initialize the normalized name map. this never needs to change, 
// as i18n just changes the formats, not the canonical names

for (const key of Object.keys(base_formats)) {
  normalized_name_map.set(key.toLowerCase(), key);
}

for (const key of Object.keys(aliases)) {
  normalized_name_map.set(key.toLowerCase(), key);
}


// call init method on defaults
InitCache();



