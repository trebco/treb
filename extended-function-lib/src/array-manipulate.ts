
import { Box, type UnionValue, ValueType } from 'treb-base-types';
import { AddExtendedFunction, ValueError } from 'treb-calculator';

AddExtendedFunction('DROP', {
  description: 'Excludes rows and/or columns from the start or end of an array',
  arguments: [
    { name: 'array', description: 'The array from which to drop rows/columns', boxed: true },
    { name: 'rows', description: 'Number of rows to drop. Positive drops from top, negative from bottom.' },
    { name: 'columns', description: 'Number of columns to drop. Positive drops from left, negative from right.' },
  ],
  fn: (array?: UnionValue, rows?: number, columns?: number): UnionValue => {

    if (!array || array.type !== ValueType.array) return ValueError();

    // ArrayUnion.value is column-major: value[col][row]
    const data = array.value;
    if (data.length === 0) return ValueError();

    const col_count = data.length;
    const row_count = data[0].length;

    const drop_rows = rows ?? 0;
    const drop_cols = columns ?? 0;

    let row_start: number;
    let row_end: number;

    if (drop_rows >= 0) {
      row_start = drop_rows;
      row_end = row_count;
    } else {
      row_start = 0;
      row_end = row_count + drop_rows;
    }

    let col_start: number;
    let col_end: number;

    if (drop_cols >= 0) {
      col_start = drop_cols;
      col_end = col_count;
    } else {
      col_start = 0;
      col_end = col_count + drop_cols;
    }

    if (row_start >= row_end || col_start >= col_end) return ValueError();

    const result: UnionValue[][] = [];
    for (let c = col_start; c < col_end; c++) {
      result.push(data[c].slice(row_start, row_end));
    }

    return { type: ValueType.array, value: result };
  },
});

AddExtendedFunction('EXPAND', {
  description: 'Expands an array to specified dimensions, padding with a fill value',
  arguments: [
    { name: 'array', description: 'The array to expand', boxed: true },
    { name: 'rows', description: 'Number of rows in the expanded array' },
    { name: 'columns', description: 'Number of columns in the expanded array' },
    { name: 'pad_with', description: 'Value to fill new cells with', boxed: true },
  ],
  fn: (array?: UnionValue, rows?: number, columns?: number, pad_with?: UnionValue): UnionValue => {

    if (!array || array.type !== ValueType.array) return ValueError();

    // column-major: value[col][row]
    const data = array.value;
    if (data.length === 0) return ValueError();

    const src_cols = data.length;
    const src_rows = data[0].length;

    const target_rows = rows ?? src_rows;
    const target_cols = columns ?? src_cols;

    if (target_rows < src_rows || target_cols < src_cols) return ValueError();

    const fill = pad_with ?? Box(0);

    const result: UnionValue[][] = [];
    for (let c = 0; c < target_cols; c++) {
      const col: UnionValue[] = [];
      for (let r = 0; r < target_rows; r++) {
        if (c < src_cols && r < src_rows) {
          col.push(data[c][r]);
        } else {
          col.push(fill);
        }
      }
      result.push(col);
    }

    return { type: ValueType.array, value: result };
  },
});

function FlattenArray(data: UnionValue[][]): UnionValue[] {
  const col_count = data.length;
  const row_count = data[0].length;
  const flat: UnionValue[] = [];
  for (let r = 0; r < row_count; r++) {
    for (let c = 0; c < col_count; c++) {
      flat.push(data[c][r]);
    }
  }
  return flat;
}

function FlattenByColumn(data: UnionValue[][]): UnionValue[] {
  const flat: UnionValue[] = [];
  for (const col of data) {
    for (const val of col) {
      flat.push(val);
    }
  }
  return flat;
}

function FilterFlattened(flat: UnionValue[], ignore: number): UnionValue[] {
  if (ignore === 0) return flat;
  return flat.filter(v => {
    if ((ignore & 1) && v.type === ValueType.undefined) return false;
    if ((ignore & 2) && v.type === ValueType.error) return false;
    return true;
  });
}

AddExtendedFunction('WRAPCOLS', {
  description: 'Wraps a vector into columns of a specified size',
  arguments: [
    { name: 'vector', description: 'The vector or reference to wrap', boxed: true },
    { name: 'wrap_count', description: 'Number of values per column' },
    { name: 'pad_with', description: 'Value for padding cells', boxed: true },
  ],
  fn: (vector?: UnionValue, wrap_count?: number, pad_with?: UnionValue): UnionValue => {

    if (!vector || vector.type !== ValueType.array || !wrap_count || wrap_count < 1) return ValueError();

    const data = vector.value;
    if (data.length === 0) return ValueError();

    const flat = FlattenArray(data);
    const target_cols = Math.ceil(flat.length / wrap_count);
    const fill = pad_with ?? Box(0);

    // column-major: result[col][row]
    const result: UnionValue[][] = [];
    for (let c = 0; c < target_cols; c++) {
      const col: UnionValue[] = [];
      for (let r = 0; r < wrap_count; r++) {
        const idx = c * wrap_count + r;
        col.push(idx < flat.length ? flat[idx] : fill);
      }
      result.push(col);
    }

    return { type: ValueType.array, value: result };
  },
});

AddExtendedFunction('TOCOL', {
  description: 'Flattens an array into a single column',
  arguments: [
    { name: 'array', description: 'The array to flatten', boxed: true },
    { name: 'ignore', description: '0=keep all, 1=ignore blanks, 2=ignore errors, 3=ignore both' },
    { name: 'scan_by_column', description: 'Scan by column (default true)' },
  ],
  fn: (array?: UnionValue, ignore?: number, scan_by_column?: number): UnionValue => {

    if (!array || array.type !== ValueType.array) return ValueError();

    const data = array.value;
    if (data.length === 0) return ValueError();

    const by_column = scan_by_column !== 0;
    const flat = by_column ? FlattenByColumn(data) : FlattenArray(data);

    const filtered = FilterFlattened(flat, ignore ?? 0);
    if (filtered.length === 0) return ValueError();

    return { type: ValueType.array, value: [filtered] };
  },
});

AddExtendedFunction('TOROW', {
  description: 'Flattens an array into a single row',
  arguments: [
    { name: 'array', description: 'The array to flatten', boxed: true },
    { name: 'ignore', description: '0=keep all, 1=ignore blanks, 2=ignore errors, 3=ignore both' },
    { name: 'scan_by_column', description: 'Scan by column (default true)' },
  ],
  fn: (array?: UnionValue, ignore?: number, scan_by_column?: number): UnionValue => {

    if (!array || array.type !== ValueType.array) return ValueError();

    const data = array.value;
    if (data.length === 0) return ValueError();

    const by_column = scan_by_column !== 0;
    const flat = by_column ? FlattenByColumn(data) : FlattenArray(data);

    const filtered = FilterFlattened(flat, ignore ?? 0);
    if (filtered.length === 0) return ValueError();

    return { type: ValueType.array, value: filtered.map(v => [v]) };
  },
});

AddExtendedFunction('WRAPROWS', {
  description: 'Wraps a vector into rows of a specified size',
  arguments: [
    { name: 'vector', description: 'The vector or reference to wrap', boxed: true },
    { name: 'wrap_count', description: 'Number of values per row' },
    { name: 'pad_with', description: 'Value for padding cells', boxed: true },
  ],
  fn: (vector?: UnionValue, wrap_count?: number, pad_with?: UnionValue): UnionValue => {

    if (!vector || vector.type !== ValueType.array || !wrap_count || wrap_count < 1) return ValueError();

    const data = vector.value;
    if (data.length === 0) return ValueError();

    const flat = FlattenArray(data);
    const target_rows = Math.ceil(flat.length / wrap_count);
    const fill = pad_with ?? Box(0);

    // column-major: result[col][row]
    const result: UnionValue[][] = [];
    for (let c = 0; c < wrap_count; c++) {
      const col: UnionValue[] = [];
      for (let r = 0; r < target_rows; r++) {
        const idx = r * wrap_count + c;
        col.push(idx < flat.length ? flat[idx] : fill);
      }
      result.push(col);
    }

    return { type: ValueType.array, value: result };
  },
});

AddExtendedFunction('TRIMRANGE', {
  description: 'Trims trailing empty rows and columns from an array',
  arguments: [
    { name: 'array', description: 'The array to trim', boxed: true },
  ],
  fn: (array?: UnionValue): UnionValue => {

    if (!array || array.type !== ValueType.array) return ValueError();

    // column-major: data[col][row]
    const data = array.value;
    if (data.length === 0) return ValueError();

    const col_count = data.length;
    const row_count = data[0].length;

    let last_row = -1;
    let last_col = -1;

    for (let c = 0; c < col_count; c++) {
      for (let r = 0; r < row_count; r++) {
        if (data[c][r].type !== ValueType.undefined) {
          if (r > last_row) last_row = r;
          if (c > last_col) last_col = c;
        }
      }
    }

    if (last_row < 0) return ValueError();

    const result: UnionValue[][] = [];
    for (let c = 0; c <= last_col; c++) {
      result.push(data[c].slice(0, last_row + 1));
    }

    return { type: ValueType.array, value: result };
  },
});

AddExtendedFunction('UNIQUE', {
  description: 'Returns unique values from a range',
  arguments: [
    { name: 'array', description: 'The array to filter', boxed: true },
    { name: 'by_col', description: 'Compare by column instead of row' },
    { name: 'exactly_once', description: 'Only return values that appear exactly once' },
  ],
  fn: (array?: UnionValue, by_col?: number, exactly_once?: number): UnionValue => {

    if (!array || array.type !== ValueType.array) return ValueError();

    // column-major: data[col][row]
    const data = array.value;
    if (data.length === 0) return ValueError();

    const compare_by_col = !!by_col;
    const once_only = !!exactly_once;

    if (compare_by_col) {
      const keys: string[] = [];
      for (let c = 0; c < data.length; c++) {
        keys.push(data[c].map(v => `${v.type}:${v.value}`).join('\0'));
      }

      const indices = UniqueIndices(keys, once_only);
      if (indices.length === 0) return ValueError();

      return { type: ValueType.array, value: indices.map(i => data[i]) };
    }

    const row_count = data[0].length;
    const col_count = data.length;
    const keys: string[] = [];
    for (let r = 0; r < row_count; r++) {
      const parts: string[] = [];
      for (let c = 0; c < col_count; c++) {
        parts.push(`${data[c][r].type}:${data[c][r].value}`);
      }
      keys.push(parts.join('\0'));
    }

    const indices = UniqueIndices(keys, once_only);
    if (indices.length === 0) return ValueError();

    const result: UnionValue[][] = [];
    for (let c = 0; c < col_count; c++) {
      result.push(indices.map(i => data[c][i]));
    }
    return { type: ValueType.array, value: result };
  },
});

function UniqueIndices(keys: string[], once_only: boolean): number[] {
  const counts = new Map<string, number>();
  for (const key of keys) {
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const seen = new Set<string>();
  const indices: number[] = [];
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (seen.has(key)) continue;
    seen.add(key);
    if (once_only && (counts.get(key) ?? 0) > 1) continue;
    indices.push(i);
  }
  return indices;
}
