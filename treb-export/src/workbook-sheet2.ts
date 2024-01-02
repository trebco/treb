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

/**
 * switching to a different xml library, and trying to simplify how
 * we deal with XLSX files. 
 * 
 * the original impetus for the switch was CSP -- ElementTree uses eval 
 * (actually new Function(...)) which is blocked by CSP, and I don't want to 
 * allow it (or patch ET). so we swtiched to fast-xml-parser, but optimally we 
 * should not be reliant on the actual parser, if we can have some sort of 
 * common data structure.
 * 
 * in any event, in the old scheme we were constantly updating the XML tree
 * so we could write back. in the new scheme, we'll start from raw data, build
 * a structure, and then generate XML from that. 
 * 
 * the primary problems we are going to run into are namespacing and output
 * ordering, but we can probably get through it.
 * 
 * output ordering may be the hardest one, because different browsers. if 
 * necessary we can custom roll the js -> xml side.
 */


import type { AddressType, RangeType} from './address-type';
import { is_range } from './address-type';
import type { SharedStrings } from './shared-strings2';
import type { Drawing } from './drawing2/drawing2';
import type { RelationshipMap } from './relationship';

export interface SheetOptions {
  name?: string;
  id?: number;
  rid?: any;
}

export interface RangeOptions {
  merge?: boolean;
  style?: number;
  precalc?: boolean|string|number;
  preserveStyle?: boolean;
  type?: string;
  array?: string;
}

export enum VisibleState {
  visible,
  hidden,
  very_hidden,
}

export class Sheet {

  public path?: string;
  public rels_path?: string;
  public rels: RelationshipMap = {};

  public sheet_data: any = {};

  public shared_strings?: SharedStrings;
  public extent?: RangeType;

  public visible_state?: VisibleState;

  public tab_selected = false;
  public default_width = 0;

  public drawings: Drawing[] = [];

  constructor(public options: SheetOptions = {}) {
  }

  /**
   * A1 -> {row: 1, col: 1} etc.
   * in the event of a range, { from: {}, to: {} }
   */
  public TranslateAddress(s: string): AddressType | RangeType {
    s = s.toUpperCase();
    let m = s.match(/([A-Z]+\d+):([A-Z]+\d+)/);
    if (m) {
      return {
        from: this.TranslateAddress(m[1]) as AddressType,
        to: this.TranslateAddress(m[2]) as AddressType,
      };
    }

    let row = 0;
    let col = 0;

    m = s.match(/^([A-Z]+)(\d+)$/);

    if (m) {
      row = Number(m[2]);
      col = 0;
      const len = m[1].length;
      for (let i = 0; i < len; i++) {
        const c = (m[1].charCodeAt(i) - 64);
        col = col * 26 + c;
      }
    }
    return { row, col };
  }

  /**
   * { row: 1, col: 1 } -> A1.
   * for ranges, {from: {}, to: {}} -> A1:B2
   */
  public Address(r: AddressType | RangeType, absolute = false): string {
    if (is_range(r)) {
      return this.Address(r.from, absolute) + ':' + this.Address(r.to, absolute);
    }
    let c = '';
    let col = r.col;
    while (col > 0) {
      const x = ((col - 1) % 26) + 1;
      c = String.fromCharCode(64 + x) + c;
      col = (col - x) / 26;
    }
    const s = r.sheet ? `'${r.sheet}'!` : '';
    if (absolute) {
      return `${s}$${c}$${r.row}`;
    }
    return s + c + r.row;
  }


  /**
   * convert an address (either style) to BOTH A1 and R1C1
   */
  public NormalizeAddress(rng: string | AddressType | RangeType): { a: string, rc: RangeType|AddressType } {
    let a: string;
    let rc: AddressType | RangeType;
    if (typeof rng === 'string') {
      a = rng.toUpperCase();
      rc = this.TranslateAddress(a);
    }
    else {
      rc = rng;
      a = this.Address(rc);
    }
    return { a, rc };
  }

  public Parse(): void {

    // we can read column/row sizes in here, or anything else we need to do
    // atm just extent

    const dim = this.sheet_data.worksheet?.dimension?.a$?.ref;

    const extent = this.TranslateAddress(dim || '');
    if (is_range(extent)) {
      this.extent = JSON.parse(JSON.stringify(extent));
    }
    else {
      this.extent = {
        from: JSON.parse(JSON.stringify(extent)),
        to: JSON.parse(JSON.stringify(extent)),
      };
    }

  }

}
