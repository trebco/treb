/**
 * This file is part of TREB.
 * Copyright 2022 trebco, llc.
 * info@treb.app
 */

import { UnionValue, ValueType } from 'treb-base-types';
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
   */
  Series: {
    arguments: [
      { name: 'Label' }, // , metadata: true, },
      { name: 'X', metadata: true, },
      { name: 'Y', metadata: true, },
      { name: 'index', },
      { name: 'subtype', },
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

};
