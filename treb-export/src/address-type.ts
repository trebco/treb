/**
 * This file is part of TREB.
 * Copyright 2022 trebco, llc.
 * info@treb.app
 */

/** represents address in a sheet */
export interface AddressType {
  row: number;
  col: number;
  sheet?: string;
}

/** typeguard for address */
export const is_address = (candidate: any): candidate is AddressType => {
  return 'row' in candidate &&
    'col' in candidate;
};

/** represents range in a sheet (e.g. A1:B2) */
export interface RangeType {
  from: AddressType;
  to: AddressType;
  sheet?: string;
}

export interface HyperlinkType {
  address: AddressType;
  reference: string;
  text: string;
}

/** typeguard for range */
export const is_range = (candidate: any): candidate is RangeType => {
  return 'from' in candidate &&
    'to' in candidate &&
    is_address(candidate.from) &&
    is_address(candidate.to);
};

export const InRange = (range: RangeType, address: AddressType) => {
  return address.sheet === range.sheet &&
    address.row >= range.from.row &&
    address.row <= range.to.row &&
    address.col >= range.from.col &&
    address.col <= range.to.col;
};

export const ShiftRange = (range: RangeType, rows = 0, columns = 0) => {
  return {
    from: {
      row: range.from.row + rows,
      col: range.from.col + columns,
      sheet: range.from.sheet,
    }, to: {
      row: range.to.row + rows,
      col: range.to.col + columns,
      sheet: range.to.sheet,
    },
  };
};

