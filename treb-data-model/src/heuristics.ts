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

import { Area, ValueType, type IArea } from 'treb-base-types';
import { Sheet } from './sheet';
import { type ConstantStep, DetectConstantStep } from './timeline';

/*
 * collecting various heuristics for data layout detection. not sure where
 * this belongs, but it will need access to sheet data. we can pass in 
 * the selection or "seed"
 */

/**
 * given a seed range (usually selection), expand in 4 directions to 
 * find all non-blank cells. watch out for holes (maybe run twice?)
 * 
 * actually I can see a couple of different ways to do this, useful
 * in different contexts. perhaps we'll add an option
 * 
 */
export function ExpandRegion(seed: IArea, sheet: Sheet): Area {
  const area = new Area(seed.start, seed.end);

  // in this version we'll puff out as long as there are _some_ non-empty
  // cells in any direction. is that too loose? maybe there should be a 
  // heuristic like "must be at least 50%" full. 

  // actually excel will apparently consume, at least with Ctrl+A

  let empty_tolerance = .5;

  for (;;) {

    let compare = new Area(area.start, area.end);

    for (let populated = true; populated && area.start.row > 0; ) {
      populated = false;
      for (let column = area.start.column; column <= area.end.column; column++) {
        const address = {row: area.start.row - 1, column};
        const cell = sheet.CellData(address);
        if (cell.merge_area && (cell.merge_area.start.row !== address.row || cell.merge_area.start.column !== address.column)) {
          continue;
        }
        if (cell.area || cell.spill || cell.value !== undefined) {
          populated = true;
          if (cell.area || cell.spill) {
            area.ConsumeArea((cell.area || cell.spill) as IArea);
          }
          else {
            area.ConsumeAddress(address);
          }
          break;
        }
      }
    }

    for (let populated = true; populated; ) {
      populated = false;
      for (let column = area.start.column; column <= area.end.column; column++) {
        const address = {row: area.end.row + 1, column}
        const cell = sheet.CellData(address);
        if (cell.merge_area && (cell.merge_area.start.row !== address.row || cell.merge_area.start.column !== address.column)) {
          continue;
        }
        if (cell.area || cell.spill || cell.value !== undefined) {
          populated = true;
          if (cell.area || cell.spill) {
            area.ConsumeArea((cell.area || cell.spill) as IArea);
          }
          else {
            area.ConsumeAddress(address);
          }
          break;
        }
      }
    }

    for (let populated = true; populated && area.start.column > 0; ) {
      populated = false;
      for (let row = area.start.row; row <= area.end.row; row++) {
        const address = {row, column: area.start.column - 1};
        const cell = sheet.CellData(address);
        if (cell.merge_area && (cell.merge_area.start.row !== address.row || cell.merge_area.start.column !== address.column)) {
          continue;
        }
        if (cell.area || cell.spill || cell.value !== undefined) {
          populated = true;
          if (cell.area || cell.spill) {
            area.ConsumeArea((cell.area || cell.spill) as IArea);
          }
          else {
            area.ConsumeAddress(address);
          }
          break;
        }
      }
    }

    for (let populated = true; populated; ) {
      populated = false;
      for (let row = area.start.row; row <= area.end.row; row++) {
        const address = {row, column: area.end.column + 1};
        const cell = sheet.CellData(address);
        if (cell.merge_area && (cell.merge_area.start.row !== address.row || cell.merge_area.start.column !== address.column)) {
          continue;
        }
        if (cell.area || cell.spill || cell.value !== undefined) {
          populated = true;
          if (cell.area || cell.spill) {
            area.ConsumeArea((cell.area || cell.spill) as IArea);
          }
          else {
            area.ConsumeAddress(address);
          }
          break;
        }
      }
    }

    if (area.Equals(compare)) {
      break;
    }

  }

  return area;
}

/**
 * determine if the data has headers. we infer this if the first row or
 * column has a different data time or formatting type than the other rows/columns.
 * @param area 
 */
export function HasHeaders(area: Area, sheet: Sheet) {

  const headers = { 
    row_headers: false, 
    implied_row_headers: false,
    column_headers: false,
  };

  if (area.rows > 1) {
    let headers_found = 0;
    let blanks = 0;

    for (let column = area.start.column; column <= area.end.column; column++) {
      let cell = sheet.CellData({row: area.start.row, column});
      let header_found = (cell.calculated && cell.calculated_type === ValueType.string) || cell.type === ValueType.string;
      let blank_found = !header_found && !cell.calculated && cell.type === ValueType.undefined;

      if (header_found || blank_found) {
        let table = 0;
        for (let row = area.start.row + 1; row <= area.end.row; row++) {
          cell = sheet.CellData({row, column});
          if (cell.calculated_type !== ValueType.string && cell.type !== ValueType.string){ 
            table++;
          }
        }
        if (table/(area.rows - 1) > .9) {
          headers_found++;
        }
      }
    }
    if ((headers_found / area.columns) >= .5) {
      headers.column_headers = true;
    }
  }

  if (area.columns > 1) {
    let headers_found = 0;
    for (let row = area.start.row; row <= area.end.row; row++) {
      let cell = sheet.CellData({row, column: area.start.column});
      if ((cell.calculated && cell.calculated_type === ValueType.string) || cell.type === ValueType.string) {
        let table = 0;
        for (let column = area.start.column + 1; column <= area.end.column; column++) {
          cell = sheet.CellData({row, column});
          if (cell.calculated_type !== ValueType.string && cell.type !== ValueType.string){ 
            table++;
          }
        }
        if (table/(area.columns - 1) > .9) {
          headers_found++;
        }
      }
    }
    if ((headers_found / area.columns) >= .5) {
      headers.row_headers = true;
    }
  }

  // special case: if we have numbers in the first row, but no column headers,
  // and we have column headers but not in the first column, we can interpret
  // that as row headers.

  if (area.columns > 1 && headers.column_headers && !headers.row_headers) {
    let implied_headers = false;
    let cell = sheet.CellData(area.start);
    if (!cell.calculated && !cell.value) {
      implied_headers = true;
      for (let row = area.start.row + 1; row <= area.end.row; row++) {
        cell = sheet.CellData({column: area.start.column, row});
        if (cell.calculated_type === ValueType.number || (cell.calculated === undefined && cell.type === ValueType.number)) {

        }
        else {
          implied_headers = false;
        }
      }
    }
    if (implied_headers) {
      headers.row_headers = true;
      headers.implied_row_headers = true;
    }
  }

  return headers;
}

/**
 * find timeline for forecast analysis. must be numeric, monotonic (although
 * it can use date math) and we allow holes. should usually be leftmost or 
 * closer to the left than the right.
 */
export function FindTrendTimeline(area: Area): Area|undefined {

  return undefined;
}

/**
 * find values for forecast analysis. should be to the right of the timeline,
 * must be numeric, although there can be holes.
 */
export function FindTrendValues(area: Area, timeline?: Area): Area|undefined {

  return undefined;
}

/**
 * check if the area is all numbers. returns the array of numbers, or undefined
 * on any non-numeric value.
 */
export function AllNumeric(area: Area, sheet: Sheet): number[]|undefined {

  const numbers: number[] = [];

  for (const cell of area) {
    const data = sheet.CellData(cell);
    if (data.calculated_type === ValueType.number) {
      numbers.push(data.calculated as number);
    }
    else if (data.type === ValueType.number) {
      numbers.push(data.value as number);
    }
    else {
      return undefined;
    }
  }

  return numbers;

}

/**
 * this method assumes there's a single column, headers already removed
 */
export function IsTimeline(area: Area, sheet: Sheet): ConstantStep | undefined {

  const numbers = AllNumeric(area, sheet);
  if (numbers) {
    return DetectConstantStep(numbers);
  }

  return undefined;

}

/**
 * trim empty cells from the range. top and bottom only, atm
 */
export function TrimUndefined(source: Area, sheet: Sheet): Area|undefined {
  let area = source.Clone();

  top:
  for (let row = area.start.row; row <= area.end.row; row++) {
    for (let column = area.start.column; column <= area.end.column; column++) {
      const data = sheet.CellData({row, column});
      if (data.value !== undefined) {
        if (row > area.start.row) {
          area = new Area({...area.start, row}, area.end);
        }
        break top;
      }
    }
    if (row === area.end.row) {
      return undefined;
    }
  }

  bottom: 
  for (let row = area.end.row; row >= area.start.row; row--) {
    for (let column = area.start.column; column <= area.end.column; column++) {
      const data = sheet.CellData({row, column});
      if (data.value !== undefined) {
        if (row < area.end.row) {
          area = new Area(area.start, {...area.end, row});
        }
        break bottom;
      }
    }
  }

  return area;
}

export { DetectConstantStep, ProjectTimeline } from './timeline';