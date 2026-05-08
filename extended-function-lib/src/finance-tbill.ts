import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';

AddExtendedFunction('TBILLPRICE', {
  description: 'Returns the price per $100 face value for a Treasury bill',
  arguments: [
    { name: 'settlement', description: 'The settlement date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'discount', description: 'The discount rate' },
  ],
  fn: (settlement?: number, maturity?: number, discount?: number): UnionValue => {
    if (settlement === undefined || maturity === undefined || discount === undefined) return ValueError();
    const dsm = maturity - settlement;
    if (dsm <= 0 || discount <= 0) return ValueError();
    return Box(100 * (1 - discount * dsm / 360));
  },
});

AddExtendedFunction('TBILLYIELD', {
  description: 'Returns the yield for a Treasury bill',
  arguments: [
    { name: 'settlement', description: 'The settlement date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'price', description: 'The price per $100 face value' },
  ],
  fn: (settlement?: number, maturity?: number, price?: number): UnionValue => {
    if (settlement === undefined || maturity === undefined || price === undefined) return ValueError();
    const dsm = maturity - settlement;
    if (dsm <= 0 || price <= 0) return ValueError();
    return Box((100 - price) / price * (360 / dsm));
  },
});

AddExtendedFunction('TBILLEQ', {
  description: 'Returns the bond-equivalent yield for a Treasury bill',
  arguments: [
    { name: 'settlement', description: 'The settlement date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'discount', description: 'The discount rate' },
  ],
  fn: (settlement?: number, maturity?: number, discount?: number): UnionValue => {
    if (settlement === undefined || maturity === undefined || discount === undefined) return ValueError();
    const dsm = maturity - settlement;
    if (dsm <= 0 || discount <= 0) return ValueError();

    if (dsm <= 182) {
      return Box((365 * discount) / (360 - discount * dsm));
    }

    const price = 100 * (1 - discount * dsm / 360);
    const term1 = -(2 * dsm / 365);
    const term2 = Math.pow(2 * dsm / 365, 2) - 4 * (2 * dsm / 365 - 1) * (1 - 100 / price);
    if (term2 < 0) return ValueError();
    return Box((Math.sqrt(term2) + term1) / (2 * (2 * dsm / 365 - 1)));
  },
});
