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

import { type UnionValue, ValueType } from 'treb-base-types';
import type { FunctionMap } from 'treb-calculator/src/descriptors';

/** 
 * function returns its arguments 
 * 
 * UPDATE: box this properly as "extended" type 
 */
const Identity = (...args: any[]): UnionValue => {
  return {
    type: ValueType.object,
    value: args,
    key: 'arguments',
  };
};

/**
 * chart functions for registration
 */
export const ChartFunctions: FunctionMap = {

  /* new: also helper */
  Group: {
    arguments: [
      { name: 'Array...', metadata: true, },
    ],
    fn: (...args: any) => {
      return {
        type: ValueType.object,
        value: args,
        key: 'group',
      };

    }
  },

  /**
   * UPDATE: adding explicit names to Series, for convention. Use the 
   * more general "group" if you just want to group things.
   * 
   * boxing properly as "extended" type
   * 
   * this is getting too specific to bubble charts, which have a lot
   * of requirements that other charts don't have. can we split? 
   * 
   */
  Series: {
    arguments: [
      { name: 'Label' }, // , metadata: true, },
      { name: 'X', metadata: true, },
      { name: 'Y', metadata: true, },
      { name: 'Z', metadata: true, },
      { name: 'index', },
      { name: 'subtype', },
      { name: 'Labels', description: 'Labels for bubble charts only (atm)' },
    ],
    fn: (...args: any) => {
      return {
        type: ValueType.object,
        value: args,
        key: 'series',
      };
    }

  },

  'Bar.Chart': {
    arguments: [
      { name: 'Data', metadata: true, },
      { name: 'Categories', metadata: true, },
      { name: 'ChartTitle' },
    ],
    fn: Identity,
  },

  'Line.Chart': {
    arguments: [
      { name: 'y', metadata: true,  },
      { name: 'x', metadata: true,  },
      { name: 'ChartTitle' },
    ],
    fn: Identity,
  },

  'Area.Chart': {
    arguments: [
      { name: 'y', metadata: true,  },
      { name: 'x', metadata: true,  },
      { name: 'ChartTitle' },
    ],
    fn: Identity,
  },

  'Pie.Chart': {
    arguments: [
      { name: 'Values', metadata: true, },
      { name: 'Labels' },
      { name: 'Title' },
      { name: 'Sort' },
      { name: 'Label' },
    ],
    fn: Identity,
  },

  'Donut.Chart': {
    arguments: [
      { name: 'Values', metadata: true, },
      { name: 'Labels', metadata: true },
      { name: 'Title' },
      { name: 'Sort' },
      { name: 'Label' },
    ],
    fn: Identity,
  },

 'Scatter.Line': {
    arguments: [
      { name: 'Data', metadata: true, },
      { name: 'ChartTitle' },
    ],
    fn: Identity,
  },

  'Scatter.Plot': {
    arguments: [
      { name: 'Data', metadata: true, },
      { name: 'ChartTitle' },
    ],
    fn: Identity,
  },

 'Column.Chart': {
    arguments: [
      { name: 'Data', metadata: true, },
      { name: 'Categories', metadata: true, },
      { name: 'Chart Title' },
    ],
    fn: Identity,
  },

  'Bubble.Chart': {
    arguments: [
      { name: 'Data', metadata: true, },
      { name: 'Chart Title' },
    ],
    fn: Identity,
  },

};
