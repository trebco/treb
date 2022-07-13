/**
 * 
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
 * with Foobar. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

enum ParseState {
  default = 0,
  quoted = 1,
}

/**
 * csv parser, following (largely) RFC4180 rules, with some extensions.
 * specifically:
 *
 * - lines should end with CRLF, but we support CR
 * - we do not support header (atm)
 * - variable-length records are supported
 * - any field may be quoted
 * - quoted fields can contain newlines and commas
 * - use two double-quotes to escape a double quote
 *
 */
export const ParseCSV = (text: string, delimiter = ','): string[][] => {

  let state: ParseState = ParseState.default;
  let record: string[] = [];
  let field = '';

  const records: string[][] = [];
  const length = text.length;

  if (/[\r\n"]/.test(delimiter)) {
    throw new Error('invalid delimiter');
  }

  for (let i = 0; i < length; i++ ){
    const char = text[i];
    if (state === ParseState.default) {
      switch (char) {
        case delimiter:
          record.push(field);
          field = '';
          break;

        case '\r':
          // naked (non-quoted) \r without immediate \n is illegal

          // if (i + 1 < length && text[i + 1] === '\n') i++; // drop into next block
          // else
          break;

        case '\n':
          record.push(field);
          field = '';
          records.push(record);
          record = [];
          break;

        case '"':
          // we're allowing unescaped double-quotes in non-quoted fields

          if (field.length === 0) {
            state = ParseState.quoted;
          }
          else {
            field += char;
          }
          break;

        default:
          field += char;
          break;
      }
    }
    else {
      if (char === '"') {
        if (i + 1 < length && text[i + 1] === '"') {
          field += '"';
          i++;
        }
        else {
          state = ParseState.default;
        }
      }
      else field += char;
    }
  }

  // we're at the end. this might be a blank line at the end of the
  // file, or it might be the end of the last record. let's make the
  // simplifying assumption that we can drop a blank line, instead
  // of treating it as a record with one zero-length field.

  if (record.length || field.length) {
    record.push(field);
    records.push(record);
  }

  return records;

};
