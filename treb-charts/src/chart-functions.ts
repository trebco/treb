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

import { type UnionValue, ValueType } from 'treb-base-types';
import type { CompositeFunctionDescriptor } from 'treb-calculator/src/descriptors';

/** 
 * function returns its arguments 
 * 
 * UPDATE: box this properly as "extended" type 
 */
const Identity = (...args: unknown[]): UnionValue => {
  return {
    type: ValueType.object,
    value: args,
    key: 'arguments',
  };
};

export type ChartFunction
  = 'Bar.Chart'
  | 'Line.Chart'
  | 'Area.Chart'
  | 'Column.Chart'
  | 'Bubble.Chart'
  | 'Donut.Chart'
  | 'Pie.Chart'
  | 'Scatter.Line'
  | 'Scatter.Plot'
  | 'Box.Plot'
  ;

type SupportFunction = 'Group'|'Series' ; // |'Scatter.Series';

/**
 * chart functions for registration
 */
export const ChartFunctions: Record<ChartFunction|SupportFunction, CompositeFunctionDescriptor> = {

  /* new: also helper */
  Group: {
    arguments: [
      { name: 'Array...', metadata: true, },
    ],
    fn: (...args: unknown[]) => {
      return {
        type: ValueType.object,
        value: args,
        key: 'group',
      };

    },
    category: ['grouping'],
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
      { name: 'Index', },
      { name: 'Subtype', },
      { name: 'Labels', description: 'Labels for bubble charts only (atm)' },
      { name: 'Axis', description: `Series axis (scatter plot only)` },
    ],
    fn: (...args: unknown[]) => {
      return {
        type: ValueType.object,
        value: {
          label: args[0],
          x: args[1],
          y: args[2],
          z: args[3],
          index: args[4],
          subtype: args[5],
          data_labels: args[6],
          axis: args[7],
        },
        key: 'series',
      };
    },
    category: ['chart functions'],
  },

  /*
  'Scatter.Series': {
    arguments: [
      { name: 'Label' }, // , metadata: true, },
      { name: 'X', metadata: true, },
      { name: 'Y', metadata: true, },
      { name: 'index', },
      { name: 'subtype', },
      { name: 'axis', },
    ],
    fn: (...args: unknown[]) => {
      return {
        type: ValueType.object,
        value: {
          label: args[0],
          x: args[1],
          y: args[2],
          index: args[3],
          subtype: args[4],
          axis: args[5],
        },
        key: 'series',
      };
    },
  },
  */

  'Bar.Chart': {
    arguments: [
      { name: 'Data', metadata: true, },
      { name: 'Categories', metadata: true, },
      { name: 'ChartTitle' },
    ],
    fn: Identity,
    category: ['chart functions'],
  },

  'Line.Chart': {
    arguments: [
      { name: 'y', metadata: true,  },
      { name: 'x', metadata: true,  },
      { name: 'ChartTitle' },
    ],
    fn: Identity,
    category: ['chart functions'],
  },

  'Area.Chart': {
    arguments: [
      { name: 'y', metadata: true,  },
      { name: 'x', metadata: true,  },
      { name: 'ChartTitle' },
    ],
    fn: Identity,
    category: ['chart functions'],
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
    category: ['chart functions'],
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
    category: ['chart functions'],
  },

 'Scatter.Line': {
    arguments: [
      { name: 'Data', metadata: true, },
      { name: 'ChartTitle' },
    ],
    fn: Identity,
    category: ['chart functions'],
  },

  'Scatter.Plot': {
    arguments: [
      { name: 'Data', metadata: true, },
      { name: 'ChartTitle' },
    ],
    fn: Identity,
    category: ['chart functions'],
  },

 'Column.Chart': {
    arguments: [
      { name: 'Data', metadata: true, },
      { name: 'Categories', metadata: true, },
      { name: 'Chart Title' },
    ],
    fn: Identity,
    category: ['chart functions'],
  },

  'Bubble.Chart': {
    arguments: [
      { name: 'Data', metadata: true, },
      { name: 'Chart Title' },
    ],
    fn: Identity,
    category: ['chart functions'],
  },

  'Box.Plot': {
    arguments: [
      { name: 'Data', metadata: true, },
      { name: 'Chart Title' },
      { name: 'Min/Max Style' }
    ],
    fn: Identity,
    category: ['chart functions'],
  },

};
