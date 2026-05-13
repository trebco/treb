import { Box, type UnionValue } from 'treb-base-types';
import { ValueType } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';

function FlattenToStrings(v: UnionValue): string[] {
  const result: string[] = [];
  if (v.type === ValueType.array) {
    for (const row of v.value) {
      for (const cell of row) {
        if (cell.type === ValueType.string) result.push(cell.value);
        else if (cell.type === ValueType.number) result.push(String(cell.value));
        else if (cell.type === ValueType.boolean) result.push(cell.value ? 'TRUE' : 'FALSE');
      }
    }
  } else if (v.type === ValueType.string) {
    result.push(v.value);
  } else if (v.type === ValueType.number) {
    result.push(String(v.value));
  } else if (v.type === ValueType.boolean) {
    result.push(v.value ? 'TRUE' : 'FALSE');
  }
  return result;
}

function FlattenToStringsWithBlanks(v: UnionValue): (string | null)[] {
  const result: (string | null)[] = [];
  if (v.type === ValueType.array) {
    for (const row of v.value) {
      for (const cell of row) {
        if (cell.type === ValueType.string) result.push(cell.value);
        else if (cell.type === ValueType.number) result.push(String(cell.value));
        else if (cell.type === ValueType.boolean) result.push(cell.value ? 'TRUE' : 'FALSE');
        else result.push(null);
      }
    }
  } else if (v.type === ValueType.string) {
    result.push(v.value);
  } else if (v.type === ValueType.number) {
    result.push(String(v.value));
  } else if (v.type === ValueType.boolean) {
    result.push(v.value ? 'TRUE' : 'FALSE');
  } else {
    result.push(null);
  }
  return result;
}

AddExtendedFunction('TEXTJOIN', {
  description: 'Joins text from multiple ranges with a delimiter',
  arguments: [
    { name: 'delimiter', description: 'The delimiter' },
    { name: 'ignore_empty', description: 'TRUE to ignore empty cells' },
    { name: 'text', description: 'Text values to join', boxed: true, repeat: true },
  ],
  fn: (delimiter?: string, ignore_empty?: boolean, ...texts: (UnionValue | undefined)[]): UnionValue => {
    if (delimiter === undefined) return ValueError();
    const delim = String(delimiter);
    const ignore = ignore_empty !== false;
    const parts: string[] = [];

    for (const t of texts) {
      if (!t) continue;
      const values = FlattenToStringsWithBlanks(t);
      for (const v of values) {
        if (v === null) {
          if (!ignore) parts.push('');
        } else if (v === '') {
          if (!ignore) parts.push('');
        } else {
          parts.push(v);
        }
      }
    }

    return Box(parts.join(delim));
  },
});

AddExtendedFunction('TEXTBEFORE', {
  description: 'Returns text before a given delimiter',
  arguments: [
    { name: 'text', description: 'The text to search', unroll: true },
    { name: 'delimiter', description: 'The delimiter to search for' },
    { name: 'instance_num', description: 'Which instance (default 1)' },
  ],
  fn: (text?: string, delimiter?: string, instance_num?: number): UnionValue => {
    if (text === undefined || delimiter === undefined) return ValueError();
    const s = String(text);
    const delim = String(delimiter);
    const n = instance_num === undefined ? 1 : Math.trunc(instance_num);
    if (n === 0) return ValueError();

    if (n > 0) {
      let pos = -1;
      for (let i = 0; i < n; i++) {
        pos = s.indexOf(delim, pos + 1);
        if (pos === -1) return ValueError();
      }
      return Box(s.substring(0, pos));
    } else {
      let pos = s.length;
      for (let i = 0; i < -n; i++) {
        pos = s.lastIndexOf(delim, pos - 1);
        if (pos === -1) return ValueError();
      }
      return Box(s.substring(0, pos));
    }
  },
});

AddExtendedFunction('TEXTAFTER', {
  description: 'Returns text after a given delimiter',
  arguments: [
    { name: 'text', description: 'The text to search', unroll: true },
    { name: 'delimiter', description: 'The delimiter to search for' },
    { name: 'instance_num', description: 'Which instance (default 1)' },
  ],
  fn: (text?: string, delimiter?: string, instance_num?: number): UnionValue => {
    if (text === undefined || delimiter === undefined) return ValueError();
    const s = String(text);
    const delim = String(delimiter);
    const n = instance_num === undefined ? 1 : Math.trunc(instance_num);
    if (n === 0) return ValueError();

    if (n > 0) {
      let pos = -1;
      for (let i = 0; i < n; i++) {
        pos = s.indexOf(delim, pos + 1);
        if (pos === -1) return ValueError();
      }
      return Box(s.substring(pos + delim.length));
    } else {
      let pos = s.length;
      for (let i = 0; i < -n; i++) {
        pos = s.lastIndexOf(delim, pos - 1);
        if (pos === -1) return ValueError();
      }
      return Box(s.substring(pos + delim.length));
    }
  },
});

AddExtendedFunction('DOLLAR', {
  description: 'Converts a number to text in currency format',
  arguments: [
    { name: 'number', description: 'The number to format', unroll: true },
    { name: 'decimals', description: 'Number of decimal places (default 2)' },
  ],
  fn: (num?: number, decimals?: number): UnionValue => {
    if (num === undefined) return ValueError();
    const dec = decimals === undefined ? 2 : Math.trunc(decimals);
    const rounded = dec >= 0
      ? Math.round(num * 10 ** dec) / 10 ** dec
      : Math.round(num / 10 ** -dec) * 10 ** -dec;
    const abs_val = Math.abs(rounded);
    const formatted = abs_val.toFixed(Math.max(0, dec));
    const parts = formatted.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const result = '$' + parts.join('.');
    return Box(rounded < 0 ? '(' + result + ')' : result);
  },
});

AddExtendedFunction('FIXED', {
  description: 'Formats a number as text with a fixed number of decimals',
  arguments: [
    { name: 'number', description: 'The number to format', unroll: true },
    { name: 'decimals', description: 'Number of decimal places (default 2)' },
    { name: 'no_commas', description: 'TRUE to suppress commas' },
  ],
  fn: (num?: number, decimals?: number, no_commas?: boolean): UnionValue => {
    if (num === undefined) return ValueError();
    const dec = decimals === undefined ? 2 : Math.trunc(decimals);
    const rounded = dec >= 0
      ? Math.round(num * 10 ** dec) / 10 ** dec
      : Math.round(num / 10 ** -dec) * 10 ** -dec;
    const formatted = Math.abs(rounded).toFixed(Math.max(0, dec));
    if (no_commas) {
      return Box(rounded < 0 ? '-' + formatted : formatted);
    }
    const parts = formatted.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    const result = parts.join('.');
    return Box(rounded < 0 ? '-' + result : result);
  },
});

AddExtendedFunction('NUMBERVALUE', {
  description: 'Converts text to a number in a locale-independent way',
  arguments: [
    { name: 'text', description: 'The text to convert', unroll: true },
    { name: 'decimal_separator', description: 'The decimal separator (default ".")' },
    { name: 'group_separator', description: 'The group separator (default ",")' },
  ],
  fn: (text?: string, decimal_separator?: string, group_separator?: string): UnionValue => {
    if (text === undefined) return ValueError();
    let s = String(text).trim();
    const dec_sep = decimal_separator === undefined ? '.' : String(decimal_separator);
    const grp_sep = group_separator === undefined ? ',' : String(group_separator);

    let pct_count = 0;
    while (s.endsWith('%')) {
      pct_count++;
      s = s.slice(0, -1);
    }

    if (grp_sep) {
      s = s.split(grp_sep).join('');
    }
    if (dec_sep !== '.') {
      s = s.replace(dec_sep, '.');
    }

    const result = Number(s);
    if (isNaN(result)) return ValueError();
    return Box(result / 100 ** pct_count);
  },
});
