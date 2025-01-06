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
 * Copyright 2022-2025 trebco, llc. 
 * info@treb.app
 * 
 */

import { UnlotusDate } from 'treb-format';

export const DaysInYear = (year: number) => {
  return (year % 4 === 0 && (year % 100 !== 0 || year === 1900)) ? 366 : 365;
};

export const DayOfYear = (year: number, month: number, day: number): number|false => {
  const a = ConstructDate(year, 1, 1);
  const b = ConstructDate(year, month, day);
  if (a === false || b === false) { return false; }
  return Math.round(b - a + 1);
};

export const ConstructDate = (year: number, month: number, day: number): number|false => {

  const date = new Date();
  date.setMilliseconds(0);
  date.setSeconds(0);
  date.setMinutes(0);
  date.setHours(0);
  
  if (year < 0 || year > 10000) { 
    // return ArgumentError();
    return false;
  }
  if (year < 1899) { year += 1900; }
  date.setFullYear(year);

  if (month < 1 || month > 12) {
    // return ArgumentError();
    return false;
  }
  date.setMonth(month - 1);

  if (day < 1 || day > 31) {
    // return ArgumentError();
    return false;
  }
  date.setDate(day);

  return UnlotusDate(date.getTime());

};
