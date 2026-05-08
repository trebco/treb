import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';
import {
  CoupDaysBs, CoupDaysInPeriod, CoupDaysNc,
  CoupNcdDate, CoupPcdDate, CoupNumValue,
} from './finance-date-utils';

function ValidateCouponArgs(settlement?: number, maturity?: number, frequency?: number, basis?: number): boolean {
  if (settlement === undefined || maturity === undefined || frequency === undefined || basis === undefined) return false;
  if (settlement >= maturity) return false;
  if (frequency !== 1 && frequency !== 2 && frequency !== 4) return false;
  if (basis < 0 || basis > 4) return false;
  return true;
}

AddExtendedFunction('COUPDAYBS', {
  description: 'Returns the number of days from the beginning of the coupon period to the settlement date',
  arguments: [
    { name: 'settlement', description: 'The settlement date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'frequency', description: 'The number of coupon payments per year (1, 2, or 4)' },
    { name: 'basis', description: 'The day count basis (0-4)' },
  ],
  fn: (settlement?: number, maturity?: number, frequency?: number, basis?: number): UnionValue => {
    if (!ValidateCouponArgs(settlement, maturity, frequency, basis)) return ValueError();
    return Box(CoupDaysBs(settlement!, maturity!, frequency!, basis!));
  },
});

AddExtendedFunction('COUPDAYS', {
  description: 'Returns the number of days in the coupon period containing the settlement date',
  arguments: [
    { name: 'settlement', description: 'The settlement date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'frequency', description: 'The number of coupon payments per year (1, 2, or 4)' },
    { name: 'basis', description: 'The day count basis (0-4)' },
  ],
  fn: (settlement?: number, maturity?: number, frequency?: number, basis?: number): UnionValue => {
    if (!ValidateCouponArgs(settlement, maturity, frequency, basis)) return ValueError();
    return Box(CoupDaysInPeriod(settlement!, maturity!, frequency!, basis!));
  },
});

AddExtendedFunction('COUPDAYSNC', {
  description: 'Returns the number of days from the settlement date to the next coupon date',
  arguments: [
    { name: 'settlement', description: 'The settlement date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'frequency', description: 'The number of coupon payments per year (1, 2, or 4)' },
    { name: 'basis', description: 'The day count basis (0-4)' },
  ],
  fn: (settlement?: number, maturity?: number, frequency?: number, basis?: number): UnionValue => {
    if (!ValidateCouponArgs(settlement, maturity, frequency, basis)) return ValueError();
    return Box(CoupDaysNc(settlement!, maturity!, frequency!, basis!));
  },
});

AddExtendedFunction('COUPNCD', {
  description: 'Returns the next coupon date after the settlement date',
  arguments: [
    { name: 'settlement', description: 'The settlement date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'frequency', description: 'The number of coupon payments per year (1, 2, or 4)' },
    { name: 'basis', description: 'The day count basis (0-4)' },
  ],
  fn: (settlement?: number, maturity?: number, frequency?: number, basis?: number): UnionValue => {
    if (!ValidateCouponArgs(settlement, maturity, frequency, basis)) return ValueError();
    return Box(CoupNcdDate(settlement!, maturity!, frequency!));
  },
});

AddExtendedFunction('COUPPCD', {
  description: 'Returns the previous coupon date before the settlement date',
  arguments: [
    { name: 'settlement', description: 'The settlement date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'frequency', description: 'The number of coupon payments per year (1, 2, or 4)' },
    { name: 'basis', description: 'The day count basis (0-4)' },
  ],
  fn: (settlement?: number, maturity?: number, frequency?: number, basis?: number): UnionValue => {
    if (!ValidateCouponArgs(settlement, maturity, frequency, basis)) return ValueError();
    return Box(CoupPcdDate(settlement!, maturity!, frequency!));
  },
});

AddExtendedFunction('COUPNUM', {
  description: 'Returns the number of coupons payable between the settlement date and maturity date',
  arguments: [
    { name: 'settlement', description: 'The settlement date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'frequency', description: 'The number of coupon payments per year (1, 2, or 4)' },
    { name: 'basis', description: 'The day count basis (0-4)' },
  ],
  fn: (settlement?: number, maturity?: number, frequency?: number, basis?: number): UnionValue => {
    if (!ValidateCouponArgs(settlement, maturity, frequency, basis)) return ValueError();
    return Box(CoupNumValue(settlement!, maturity!, frequency!));
  },
});
