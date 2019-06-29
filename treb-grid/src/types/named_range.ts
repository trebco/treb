
import { Area } from 'treb-base-types';

export interface NamedRangeCollection {
  [index: string]: Area;
}

/**
 * named range rules:
 *
 * - legal characters are alphanumeric, underscore and dot.
 * - must start with letter or underscore (not a number or dot).
 * - cannot look like a spreadsheet address, which is 1-3 letters followed by numbers.
 * 
 * returns a normalized name (just caps, atm)
 */
export const ValidateNamedRange = (name: string) => {
  name = name.trim();
  if (!name.length) return false;
  if (/^[A-Za-z]{1,3}\d+$/.test(name)) return false;
  if (/[^A-Za-z\d_\.]/.test(name)) return false;
  if (/^[^A-Za-z_]/.test(name)) return false;
  return name.toUpperCase();
};
