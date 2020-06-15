
import { Base64 } from 'js-base64';

export const DAY_MS = 1000 * 60 * 60 * 24;

export const IsArrayOrTypedArray = (test: any): boolean => {
  return Array.isArray(test) || (test instanceof Float64Array) || (test instanceof Float64Array);
};

export const TransposeArray = (arr: any[][]) => {

  if (!arr) return [];
  if (typeof arr[0] === 'undefined') return [];

  if (!IsArrayOrTypedArray(arr[0])) {
    if (arr instanceof Float32Array || arr instanceof Float64Array){
      return Array.prototype.slice.call(arr).map((x: any) => [x]);
    }
    return arr.map((x) => [x]);
  }

  const tmp: any = [];
  const cols = arr.length;
  const rows = arr[0].length;
  for (let r = 0; r < rows; r++) {
    tmp[r] = [];
    for (let c = 0; c < cols; c++ ) {
      tmp[r][c] = arr[c][r];
    }
  }
  return tmp;

};

export const StringToColumn = (s: string) => {
  let index = 0;
  s = s.toUpperCase();
  for (let i = 0; i < s.length; i++) {
    index *= 26;
    index += (s.charCodeAt(i) - 64);
  }
  return index - 1;
};

export const ColumnToString = (column: number) => {

  // there's some weird case where this hangs, not sure
  // how that happens. trap it and figure it out.

  const original = column;

  let s = '';
  while (1) {
    const c = column % 26;
    s = String.fromCharCode(65 + c) + s;
    column = Math.floor(column / 26);
    if (column) column--;
    if (column < 0) throw(new Error('Column < 0!, original was ' + original));
    else break;
  }
  return s;
};

export const OffsetFormula = (formula: string, offset: {columns: number, rows: number}) => {

  const cache: any = {};
  formula = formula.replace(/\b([A-Za-z]+)(\d+)\b/g, (m, p1, p2) => {
    if (!cache[m]) {
      const c = ColumnToString(StringToColumn(p1) + offset.columns);
      const r = Number(p2) + offset.rows;
      cache[m] = c + r.toString();
    }
    return cache[m];
  });
  return formula;

};

export const ArrayBufferToBase64 = (data: ArrayBuffer): string => {
  return Uint8ToBase64(new Uint8Array(data, 0));
};

export const Uint8ToBase64 = (data: Uint8Array): string => {

  const chunks = [];
  const block = 0x8000;
  for (let i = 0; i < data.length; i += block){
    chunks.push(String.fromCharCode.apply(null, Array.from(data.subarray(i, i + block))));
  }
  return Base64.btoa(chunks.join(''));
};


/**
 * flatten a set of arguments
 * UPDATE: we no longer accept the "arguments" object. must be an array.
 * callers can use rest spread to collect arguments.
 */
export const Flatten = (args: any[]): any[] => {
  return args.reduce((a: any[], b: any) => {
    if (typeof b === 'undefined') return a;
    if (Array.isArray(b)) return a.concat(Flatten(b));
    if (b instanceof Float32Array) return a.concat(Array.from(b));
    if (b instanceof Float64Array) return a.concat(Array.from(b));
    return a.concat([b]);
  }, []);
};

export const UndefinedToEmptyString = (args: any[]): any[] => {
  for (let i = 0; i < args.length; i++) {
    if (Array.isArray(args[i])) {
      args[i] = UndefinedToEmptyString(args[i]);
    }
    else if (typeof args[i] === 'undefined') {
      args[i] = '';
    }
  }
  return args;
};

/**
 * returns a function that applies the given function to a scalar or a matrix
 * @param base the underlying function
 */
export const ApplyArrayFunc = (base: (...args: any[]) => any) => {
  return (a: any) => {
    if (Array.isArray(a)) {
      const tmp = [];
      const rows = a[0].length;
      for (let c = 0; c < a.length; c++) {
        const col = [];
        for (let r = 0; r < rows; r++) col[r] = base(a[c][r]);
        tmp.push(col);
      }
      return tmp;
    }
    return base(a);
  };
};
