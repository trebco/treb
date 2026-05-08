import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';
import {
  YearFrac, CoupDaysBs, CoupDaysInPeriod, CoupNumValue,
  CoupPcdDate, CoupNcdDate, BisectionSolve,
} from './finance-date-utils';

function CalcOddFPrice(settlement: number, maturity: number, issue: number, first_coupon: number,
  rate: number, yld: number, redemption: number, frequency: number, basis: number): number {

  const n = CoupNumValue(settlement, maturity, frequency);
  const coup_days = CoupDaysInPeriod(settlement, first_coupon, frequency, basis);
  const dsc = first_coupon - settlement;
  const dsc_frac = dsc / coup_days;
  const coupon = 100 * rate / frequency;

  const odd_coupon = coupon * (first_coupon - issue) / coup_days;
  const accrued = coupon * (settlement - issue) / coup_days;

  let pv = odd_coupon / Math.pow(1 + yld / frequency, dsc_frac);

  for (let k = 2; k <= n; k++) {
    const cf = k < n ? coupon : coupon + redemption;
    pv += cf / Math.pow(1 + yld / frequency, k - 1 + dsc_frac);
  }

  pv -= accrued;
  return pv;
}

AddExtendedFunction('ODDFPRICE', {
  description: 'Returns the price per $100 face value of a security with an odd first period',
  arguments: [
    { name: 'settlement', description: 'The settlement date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'issue', description: 'The issue date' },
    { name: 'first_coupon', description: 'The first coupon date' },
    { name: 'rate', description: 'The annual coupon rate' },
    { name: 'yld', description: 'The annual yield' },
    { name: 'redemption', description: 'The redemption value per $100' },
    { name: 'frequency', description: 'Coupon payments per year (1, 2, or 4)' },
    { name: 'basis', description: 'The day count basis (0-4)' },
  ],
  fn: (settlement?: number, maturity?: number, issue?: number, first_coupon?: number,
    rate?: number, yld?: number, redemption?: number, frequency?: number, basis?: number): UnionValue => {
    if (settlement === undefined || maturity === undefined || issue === undefined || first_coupon === undefined ||
      rate === undefined || yld === undefined || redemption === undefined || frequency === undefined || basis === undefined) return ValueError();
    if (issue >= settlement || settlement >= first_coupon || first_coupon >= maturity) return ValueError();
    if (frequency !== 1 && frequency !== 2 && frequency !== 4) return ValueError();
    return Box(CalcOddFPrice(settlement, maturity, issue, first_coupon, rate, yld, redemption, frequency, basis));
  },
});

AddExtendedFunction('ODDFYIELD', {
  description: 'Returns the yield of a security with an odd first period',
  arguments: [
    { name: 'settlement', description: 'The settlement date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'issue', description: 'The issue date' },
    { name: 'first_coupon', description: 'The first coupon date' },
    { name: 'rate', description: 'The annual coupon rate' },
    { name: 'price', description: 'The price per $100 face value' },
    { name: 'redemption', description: 'The redemption value per $100' },
    { name: 'frequency', description: 'Coupon payments per year (1, 2, or 4)' },
    { name: 'basis', description: 'The day count basis (0-4)' },
  ],
  fn: (settlement?: number, maturity?: number, issue?: number, first_coupon?: number,
    rate?: number, price?: number, redemption?: number, frequency?: number, basis?: number): UnionValue => {
    if (settlement === undefined || maturity === undefined || issue === undefined || first_coupon === undefined ||
      rate === undefined || price === undefined || redemption === undefined || frequency === undefined || basis === undefined) return ValueError();
    if (issue >= settlement || settlement >= first_coupon || first_coupon >= maturity) return ValueError();
    if (frequency !== 1 && frequency !== 2 && frequency !== 4) return ValueError();

    const result = BisectionSolve(
      (yld) => CalcOddFPrice(settlement, maturity, issue, first_coupon, rate, yld, redemption, frequency, basis) - price,
      0, 2, 1e-10,
    );
    if (result === undefined) return ValueError();
    return Box(result);
  },
});

AddExtendedFunction('ODDLPRICE', {
  description: 'Returns the price per $100 face value of a security with an odd last period',
  arguments: [
    { name: 'settlement', description: 'The settlement date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'last_interest', description: 'The last coupon date before maturity' },
    { name: 'rate', description: 'The annual coupon rate' },
    { name: 'yld', description: 'The annual yield' },
    { name: 'redemption', description: 'The redemption value per $100' },
    { name: 'frequency', description: 'Coupon payments per year (1, 2, or 4)' },
    { name: 'basis', description: 'The day count basis (0-4)' },
  ],
  fn: (settlement?: number, maturity?: number, last_interest?: number,
    rate?: number, yld?: number, redemption?: number, frequency?: number, basis?: number): UnionValue => {
    if (settlement === undefined || maturity === undefined || last_interest === undefined ||
      rate === undefined || yld === undefined || redemption === undefined || frequency === undefined || basis === undefined) return ValueError();
    if (settlement >= maturity || last_interest >= maturity) return ValueError();
    if (frequency !== 1 && frequency !== 2 && frequency !== 4) return ValueError();

    const coup_days = CoupDaysInPeriod(settlement, maturity, frequency, basis);
    const days_li_to_mat = maturity - last_interest;
    const days_settle_to_mat = maturity - settlement;
    const days_li_to_settle = settlement - last_interest;

    const odd_frac = days_li_to_mat / coup_days;
    const dsc_frac = days_settle_to_mat / coup_days;
    const a_frac = days_li_to_settle / coup_days;

    const coupon = 100 * rate / frequency;
    const pv = (redemption + coupon * odd_frac) / (1 + yld / frequency * dsc_frac) - coupon * a_frac;

    return Box(pv);
  },
});

AddExtendedFunction('ODDLYIELD', {
  description: 'Returns the yield of a security with an odd last period',
  arguments: [
    { name: 'settlement', description: 'The settlement date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'last_interest', description: 'The last coupon date before maturity' },
    { name: 'rate', description: 'The annual coupon rate' },
    { name: 'price', description: 'The price per $100 face value' },
    { name: 'redemption', description: 'The redemption value per $100' },
    { name: 'frequency', description: 'Coupon payments per year (1, 2, or 4)' },
    { name: 'basis', description: 'The day count basis (0-4)' },
  ],
  fn: (settlement?: number, maturity?: number, last_interest?: number,
    rate?: number, price?: number, redemption?: number, frequency?: number, basis?: number): UnionValue => {
    if (settlement === undefined || maturity === undefined || last_interest === undefined ||
      rate === undefined || price === undefined || redemption === undefined || frequency === undefined || basis === undefined) return ValueError();
    if (settlement >= maturity || last_interest >= maturity || price <= 0) return ValueError();
    if (frequency !== 1 && frequency !== 2 && frequency !== 4) return ValueError();

    const coup_days = CoupDaysInPeriod(settlement, maturity, frequency, basis);
    const days_li_to_mat = maturity - last_interest;
    const days_settle_to_mat = maturity - settlement;
    const days_li_to_settle = settlement - last_interest;

    const odd_frac = days_li_to_mat / coup_days;
    const dsc_frac = days_settle_to_mat / coup_days;
    const a_frac = days_li_to_settle / coup_days;

    const coupon = 100 * rate / frequency;
    const yld = ((redemption + coupon * odd_frac) / (price + coupon * a_frac) - 1) * frequency / dsc_frac;

    return Box(yld);
  },
});
