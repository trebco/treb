/**
 * functional programming
 */

import type { FunctionMap } from '../descriptors';
import type { FunctionUnion, UnionValue} from 'treb-base-types';
import { ValueType } from 'treb-base-types';
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