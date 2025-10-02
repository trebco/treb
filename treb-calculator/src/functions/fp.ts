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

import type { FunctionMap } from '../descriptors';
import type { CellValue, FunctionUnion, UnionValue} from 'treb-base-types';
import { Box, ValueType } from 'treb-base-types';
import { ArgumentError, ValueError } from '../function-error';

export const FPFunctionLibrary: FunctionMap = {
 
  MakeArray: {
    description: 'Create an array using a function',
    arguments: [
      { name: 'rows' },
      { name: 'columns' },
      {
        name: 'lambda',
        description: 'Function to apply',
        boxed: true,
      },
    ],
    fp: true,
    fn: function(rows: number, columns: number, lambda: FunctionUnion) {
      if (rows > 0 && columns > 0 && lambda?.type === ValueType.function) {
        const apply = this?.apply;
        if (!apply) {
          return ValueError();
        }

        const value: UnionValue[][] = [];
        for (let c = 0; c < columns; c++) {
          const values_col: UnionValue[] = [];
          for (let r = 0; r < rows; r++) {
            values_col.push(apply(lambda, [
              { type: ValueType.number, value: r + 1 },
              { type: ValueType.number, value: c + 1 },
            ]));
          }
          value.push(values_col);
        } 

        return {
          type: ValueType.array,
          value,
        };

      }
      return ArgumentError();
    },
  },

  Take: {
    description: 'Returns some number of rows/columns from the start or end of an array',
    arguments: [{
      name: 'array',
    }, {
      name: 'rows',
    }, {
      name: 'columns',
    }],
    fn: function(data: CellValue|CellValue[][], rows?: number, columns?: number) {

      // we need one of rows, columns to be defined. neither can === 0.

      if ((!rows && !columns) || rows === 0 || columns === 0 || (typeof rows !== 'number' && typeof rows !== 'undefined') || (typeof columns !== 'number' && typeof columns !== 'undefined')) {
        return ArgumentError();
      }

      if (!Array.isArray(data)) {
        data = [[data]];
      }
      
      const data_columns = data.length;
      const data_rows = data[0].length;
      const result: UnionValue[][] = [];

      // I guess we can compose?

      // data is column-first

      let start_column = 0;
      let end_column = data_columns - 1;

      let start_row = 0;
      let end_row = data_rows - 1;

      if (typeof columns === 'number') {

        // clip data so it has the first (or last) X columns

        if (columns > 0) {
          end_column = Math.min(columns, data_columns) - 1;
        }
        else if (columns < 0) {
          end_column = data_columns - 1;
          start_column = Math.max(0, end_column + columns + 1);
        }

      }

      if (typeof rows === 'number') {

        // clip data so it has the first (or last) X columns

        if (rows > 0) {
          end_row = Math.min(rows, data_rows) - 1;
        }
        else if (rows < 0) {
          end_row = data_rows - 1;
          start_row = Math.max(0, end_row + rows + 1);
        }

      }

      for (let c = start_column; c <= end_column; c++) {
        const column: UnionValue[] = [];
        for (let r = start_row; r <= end_row; r++) {
          column.push(Box(data[c][r]));
        }
        result.push(column);
      }

      return {
        type: ValueType.array,
        value: result,
      }
      
    },
  },

  Reduce: {
    description: 'Accumulates a value by applying a function to a set of values',
    arguments: [
      { 
        name: 'initial value', 
        boxed: true,
      },
      {
        name: 'data', 
        description: 'Input data',
        boxed: true,
      },
      {
        name: 'lambda',
        description: 'Function to apply',
        boxed: true,
      },
    ],
    fp: true,
    fn: function(initial: UnionValue, data: UnionValue, lambda: FunctionUnion) {

      if (!this?.apply) { 
        return ValueError(); 
      }

      if (lambda.type !== ValueType.function) {
        return ArgumentError();
      }

      if (data.type !== ValueType.array) {
        data = {
          type: ValueType.array, 
          value: [[data]],
        }
      }

      const cols = data.value.length;
      const rows = data.value[0].length;

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const apply_args: UnionValue[] = [initial, data.value[c][r]];
          const result = this.apply(lambda, apply_args)
          initial = result;
        }
      }

      return initial;

    },
  },

  Scan: {
    description: 'Applies a function to a set of values, iteratively',
    arguments: [
      { 
        name: 'initial value', 
        boxed: true,
      },
      {
        name: 'data', 
        description: 'Input data',
        boxed: true,
      },
      {
        name: 'lambda',
        description: 'Function to apply',
        boxed: true,
      },
    ],
    fp: true,
    fn: function(initial: UnionValue, data: UnionValue, lambda: FunctionUnion) {

      if (!this?.apply) { 
        return ValueError(); 
      }

      if (lambda.type !== ValueType.function) {
        return ArgumentError();
      }

      if (data.type !== ValueType.array) {
        data = {
          type: ValueType.array, 
          value: [[data]],
        }
      }

      const results: UnionValue[][] = [];
      const cols = data.value.length;
      const rows = data.value[0].length;

      for (let i = 0; i < cols; i++) { results.push([])}

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const apply_args: UnionValue[] = [initial, data.value[c][r]];
          const result = this.apply(lambda, apply_args)
          results[c][r] = result;
          initial = result;
        }
      }

      return {
        type: ValueType.array,
        value: results,
      }

    },
  },

  ByRow: {
    description: 'Apply a function to each row in an array',
    arguments: [
      {
        name: 'data', 
        description: 'Input data',
        repeat: true,
        boxed: true,
      },
      {
        name: 'lambda',
        description: 'Function to apply',
        boxed: true,
      },
    ],
    fp: true,
    fn: function(data: UnionValue, lambda: FunctionUnion) {
      if (!this?.apply) { return ValueError(); }

      if (lambda.type !== ValueType.function) {
        return ArgumentError();
      }

      if (data.type !== ValueType.array) {
        data = {
          type: ValueType.array,
          value: [[data]],
        };
      }

      const cols = data.value.length;
      const rows = data.value[0].length;

      const value: UnionValue[][] = [[]];
      for (let r = 0; r < rows; r++) {
        const args: UnionValue[] = [];
        for (let c = 0; c < cols; c++) {
          args.push(data.value[c][r]);
        }
        value[0].push(this.apply(lambda, [{
          type: ValueType.array, value: [args],
        }]));
      }
      
      return {
        type: ValueType.array,
        value,
      }

    }
  },


  ByCol: {
    description: 'Apply a function to each column in an array',
    arguments: [
      {
        name: 'data', 
        description: 'Input data',
        repeat: true,
        boxed: true,
      },
      {
        name: 'lambda',
        description: 'Function to apply',
        boxed: true,
      },
    ],
    fp: true,
    fn: function(data: UnionValue, lambda: FunctionUnion) {
      if (!this?.apply) { return ValueError(); }

      if (lambda.type !== ValueType.function) {
        return ArgumentError();
      }

      if (data.type !== ValueType.array) {
        data = {
          type: ValueType.array,
          value: [[data]],
        };
      }

      const cols = data.value.length;
      const rows = data.value[0].length;

      const value: UnionValue[][] = [];
      for (let c = 0; c < cols; c++) {
        const args: UnionValue[] = [];
        for (let r = 0; r < rows; r++) {
          args.push(data.value[c][r]);
        }
        value.push([this.apply(lambda, [{
          type: ValueType.array, value: [args],
        }])]);
      }
      
      return {
        type: ValueType.array,
        value,
      }

    }
  },

  Map: {
    description: 'Apply a function to a set of values',
    arguments: [
      {
        name: 'data', 
        description: 'Input data',
        repeat: true,
        boxed: true,
      },
      {
        name: 'lambda',
        description: 'Function to apply',
        boxed: true,
      },
    ],

    fp: true,
    fn: function(...args: UnionValue[]) {

      if (args.length < 2) {
        return ArgumentError();
      }
      
      const lambda = args[args.length - 1];
      if (lambda.type !== ValueType.function) {
        return ArgumentError();
      }

      const apply = this?.apply;
      if (!apply) {
        return ValueError();
      }

      for (let i = 0; i < args.length - 1; i++) {
        const arg = args[i];
        if (arg.type !== ValueType.array) {
          args[i] = {
            type: ValueType.array,
            value: [[arg]],
          };
        }
      }

      const key = args[0];
      const results: UnionValue[][] = [];
      if (key.type === ValueType.array) {
        for (let r = 0; r < key.value.length; r++) {
          const row = key.value[r];
          const results_row: UnionValue[] = [];
          for (let c = 0; c < row.length; c++) {
            const apply_args: UnionValue[] = [row[c]];

            for (let i = 1; i < args.length - 1; i++) {
              const arg = args[i];
              if (arg.type === ValueType.array) {
                apply_args.push(arg.value[r][c])
              }
            }

            results_row.push(apply(lambda, apply_args));
          }
          results.push(results_row);
        }
      }
      
      return {
        type: ValueType.array,
        value: results,
      };

    },

  },

};