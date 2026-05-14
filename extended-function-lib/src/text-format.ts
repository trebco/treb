import { Box, type UnionValue } from 'treb-base-types';
import { ValueType } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError, NAError } from 'treb-calculator';

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

    const dec_pos = s.indexOf(dec_sep);
    if (dec_pos !== -1 && grp_sep && s.indexOf(grp_sep, dec_pos) !== -1) {
      return ValueError();
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

AddExtendedFunction('TEXTSPLIT', {
  description: 'Splits text into an array by column and/or row delimiters',
  arguments: [
    { name: 'text', description: 'The text to split' },
    { name: 'col_delimiter', description: 'Delimiter for splitting into columns', boxed: true },
    { name: 'row_delimiter', description: 'Delimiter for splitting into rows', boxed: true },
    { name: 'ignore_empty', description: 'TRUE to treat consecutive delimiters as one' },
    { name: 'match_mode', description: '0 = case-sensitive (default), 1 = case-insensitive' },
    { name: 'pad_with', description: 'Value for padding ragged arrays', boxed: true },
  ],
  fn: (text?: string, col_delimiter?: UnionValue, row_delimiter?: UnionValue, ignore_empty?: boolean, match_mode?: number, pad_with?: UnionValue): UnionValue => {
    if (text === undefined) return ValueError();
    const s = String(text);
    const ignore = ignore_empty === true;
    const case_insensitive = match_mode === 1;
    const pad = pad_with ?? NAError();

    const col_delims = ExtractDelimiters(col_delimiter);
    const row_delims = ExtractDelimiters(row_delimiter);

    if (col_delims.length === 0 && row_delims.length === 0) return ValueError();

    let rows: string[];
    if (row_delims.length > 0) {
      rows = SplitByDelimiters(s, row_delims, case_insensitive);
      if (ignore) rows = rows.filter(r => r !== '');
    } else {
      rows = [s];
    }

    let grid: string[][];
    if (col_delims.length > 0) {
      grid = rows.map(row => {
        const parts = SplitByDelimiters(row, col_delims, case_insensitive);
        return ignore ? parts.filter(p => p !== '') : parts;
      });
    } else {
      grid = rows.map(row => [row]);
    }

    const max_cols = Math.max(...grid.map(r => r.length));

    // column-major: result[col][row]
    const result: UnionValue[][] = [];
    for (let c = 0; c < max_cols; c++) {
      const col: UnionValue[] = [];
      for (let r = 0; r < grid.length; r++) {
        col.push(c < grid[r].length ? Box(grid[r][c]) : pad);
      }
      result.push(col);
    }

    return { type: ValueType.array, value: result };
  },
});

function ExtractDelimiters(v: UnionValue | undefined): string[] {
  if (!v || v.type === ValueType.undefined) return [];
  if (v.type === ValueType.string) return [v.value];
  if (v.type === ValueType.array) {
    const delims: string[] = [];
    for (const col of v.value) {
      for (const cell of col) {
        if (cell.type === ValueType.string) delims.push(cell.value);
      }
    }
    return delims;
  }
  return [];
}

function SplitByDelimiters(text: string, delimiters: string[], case_insensitive: boolean): string[] {
  const parts: string[] = [];
  const search_text = case_insensitive ? text.toLowerCase() : text;
  const search_delims = case_insensitive ? delimiters.map(d => d.toLowerCase()) : delimiters;

  let pos = 0;
  while (pos <= search_text.length) {
    let best_idx = -1;
    let best_len = 0;
    for (const d of search_delims) {
      const idx = search_text.indexOf(d, pos);
      if (idx !== -1 && (best_idx === -1 || idx < best_idx)) {
        best_idx = idx;
        best_len = d.length;
      }
    }
    if (best_idx === -1) {
      parts.push(text.substring(pos));
      break;
    }
    parts.push(text.substring(pos, best_idx));
    pos = best_idx + best_len;
  }
  return parts;
}

function FormatCellValue(v: UnionValue, strict: boolean): string {
  switch (v.type) {
    case ValueType.string:
      return strict ? `"${v.value}"` : v.value;
    case ValueType.number:
      return String(v.value);
    case ValueType.boolean:
      return v.value ? 'TRUE' : 'FALSE';
    default:
      return '';
  }
}

AddExtendedFunction('ARRAYTOTEXT', {
  description: 'Returns an array of text values from any specified range',
  arguments: [
    { name: 'array', description: 'The array to convert', boxed: true },
    { name: 'format', description: '0 = concise (default), 1 = strict' },
  ],
  fn: (array?: UnionValue, format?: number): UnionValue => {
    if (!array) return ValueError();
    const strict = format === 1;

    if (array.type !== ValueType.array) {
      return Box(FormatCellValue(array, strict));
    }

    // column-major: data[col][row]
    const data = array.value;
    if (data.length === 0) return Box('');

    const col_count = data.length;
    const row_count = data[0].length;

    if (strict) {
      const row_strings: string[] = [];
      for (let r = 0; r < row_count; r++) {
        const cells: string[] = [];
        for (let c = 0; c < col_count; c++) {
          cells.push(FormatCellValue(data[c][r], true));
        }
        row_strings.push(cells.join(','));
      }
      return Box('{' + row_strings.join(';') + '}');
    }

    const parts: string[] = [];
    for (let r = 0; r < row_count; r++) {
      for (let c = 0; c < col_count; c++) {
        const formatted = FormatCellValue(data[c][r], false);
        if (formatted !== '') parts.push(formatted);
      }
    }
    return Box(parts.join(', '));
  },
});
