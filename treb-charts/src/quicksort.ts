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

// FIXME: move

export const QuickSort = (data: number[]) => {
  Sort(data, 0, data.length);
};

const Partition = (data: number[], left: number, right: number) => {
  const compare = data[right - 1];
  let min_end = left;
  for (let max_end = left; max_end < right - 1; max_end += 1) {
    if (data[max_end] <= compare) {
      Swap(data, max_end, min_end);
      min_end += 1;
    }
  }
  Swap(data, min_end, right - 1);
  return min_end;
};

const Swap = (data: number[], i: number, j: number) => {
  const temp = data[i];
  data[i] = data[j];
  data[j] = temp;
};

const Sort = (data: number[], left: number, right: number) => {
  if (left < right) {
    const p = Partition(data, left, right);
    Sort(data, left, p);
    Sort(data, p + 1, right);
  }
}

