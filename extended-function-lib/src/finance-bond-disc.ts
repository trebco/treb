import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';
import { YearFrac } from './finance-date-utils';

AddExtendedFunction('PRICEDISC', {
  description: 'Returns the price per $100 face value of a discounted security',
  arguments: [
    { name: 'settlement', description: 'The settlement date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'discount', description: 'The discount rate' },
    { name: 'redemption', description: 'The redemption value per $100 face value' },
    { name: 'basis', description: 'The day count basis (0-4)' },
  ],
  fn: (settlement?: number, maturity?: number, discount?: number, redemption?: number, basis?: number): UnionValue => {
    if (settlement === undefined || maturity === undefined || discount === undefined || redemption === undefined || basis === undefined) return ValueError();
    if (settlement >= maturity || discount <= 0 || redemption <= 0) return ValueError();
    const yf = YearFrac(settlement, maturity, basis);
    return Box(redemption - discount * redemption * yf);
  },
});

AddExtendedFunction('YIELDDISC', {
  description: 'Returns the annual yield for a discounted security',
  arguments: [
    { name: 'settlement', description: 'The settlement date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'price', description: 'The price per $100 face value' },
    { name: 'redemption', description: 'The redemption value per $100 face value' },
    { name: 'basis', description: 'The day count basis (0-4)' },
  ],
  fn: (settlement?: number, maturity?: number, price?: number, redemption?: number, basis?: number): UnionValue => {
    if (settlement === undefined || maturity === undefined || price === undefined || redemption === undefined || basis === undefined) return ValueError();
    if (settlement >= maturity || price <= 0 || redemption <= 0) return ValueError();
    const yf = YearFrac(settlement, maturity, basis);
    return Box((redemption - price) / (price * yf));
  },
});

AddExtendedFunction('DISC', {
  description: 'Returns the discount rate for a security',
  arguments: [
    { name: 'settlement', description: 'The settlement date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'price', description: 'The price per $100 face value' },
    { name: 'redemption', description: 'The redemption value per $100 face value' },
    { name: 'basis', description: 'The day count basis (0-4)' },
  ],
  fn: (settlement?: number, maturity?: number, price?: number, redemption?: number, basis?: number): UnionValue => {
    if (settlement === undefined || maturity === undefined || price === undefined || redemption === undefined || basis === undefined) return ValueError();
    if (settlement >= maturity || price <= 0 || redemption <= 0) return ValueError();
    const yf = YearFrac(settlement, maturity, basis);
    return Box((redemption - price) / (redemption * yf));
  },
});

AddExtendedFunction('RECEIVED', {
  description: 'Returns the amount received at maturity for a fully invested security',
  arguments: [
    { name: 'settlement', description: 'The settlement date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'investment', description: 'The amount invested' },
    { name: 'discount', description: 'The discount rate' },
    { name: 'basis', description: 'The day count basis (0-4)' },
  ],
  fn: (settlement?: number, maturity?: number, investment?: number, discount?: number, basis?: number): UnionValue => {
    if (settlement === undefined || maturity === undefined || investment === undefined || discount === undefined || basis === undefined) return ValueError();
    if (settlement >= maturity || investment <= 0 || discount <= 0) return ValueError();
    const yf = YearFrac(settlement, maturity, basis);
    return Box(investment / (1 - discount * yf));
  },
});

AddExtendedFunction('INTRATE', {
  description: 'Returns the interest rate for a fully invested security',
  arguments: [
    { name: 'settlement', description: 'The settlement date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'investment', description: 'The amount invested' },
    { name: 'redemption', description: 'The amount received at maturity' },
    { name: 'basis', description: 'The day count basis (0-4)' },
  ],
  fn: (settlement?: number, maturity?: number, investment?: number, redemption?: number, basis?: number): UnionValue => {
    if (settlement === undefined || maturity === undefined || investment === undefined || redemption === undefined || basis === undefined) return ValueError();
    if (settlement >= maturity || investment <= 0 || redemption <= 0) return ValueError();
    const yf = YearFrac(settlement, maturity, basis);
    return Box((redemption - investment) / (investment * yf));
  },
});
