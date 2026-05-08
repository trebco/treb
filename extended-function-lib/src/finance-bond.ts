import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';
import {
  YearFrac, CoupDaysBs, CoupDaysInPeriod, CoupNumValue,
  BisectionSolve,
} from './finance-date-utils';

function CalcPrice(settlement: number, maturity: number, rate: number, yld: number, redemption: number, frequency: number, basis: number): number {
  const n = CoupNumValue(settlement, maturity, frequency);
  const coup_days = CoupDaysInPeriod(settlement, maturity, frequency, basis);
  const days_bs = CoupDaysBs(settlement, maturity, frequency, basis);
  const dsc_frac = (coup_days - days_bs) / coup_days;
  const coupon = 100 * rate / frequency;

  if (n === 1) {
    const t = dsc_frac / frequency;
    return (redemption + coupon) / (1 + yld * t) - coupon * (1 - dsc_frac);
  }

  let pv_coupons = 0;
  for (let k = 1; k <= n; k++) {
    pv_coupons += coupon / Math.pow(1 + yld / frequency, k - 1 + dsc_frac);
  }
  const pv_redemption = redemption / Math.pow(1 + yld / frequency, n - 1 + dsc_frac);
  const accrued = coupon * (1 - dsc_frac);

  return pv_coupons + pv_redemption - accrued;
}

AddExtendedFunction('PRICE', {
  description: 'Returns the price per $100 face value of a security that pays periodic interest',
  arguments: [
    { name: 'settlement', description: 'The settlement date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'rate', description: 'The annual coupon rate' },
    { name: 'yld', description: 'The annual yield' },
    { name: 'redemption', description: 'The redemption value per $100 face value' },
    { name: 'frequency', description: 'The number of coupon payments per year (1, 2, or 4)' },
    { name: 'basis', description: 'The day count basis (0-4)' },
  ],
  fn: (settlement?: number, maturity?: number, rate?: number, yld?: number, redemption?: number, frequency?: number, basis?: number): UnionValue => {
    if (settlement === undefined || maturity === undefined || rate === undefined || yld === undefined || redemption === undefined || frequency === undefined || basis === undefined) return ValueError();
    if (settlement >= maturity || rate < 0 || yld < 0 || redemption <= 0) return ValueError();
    if (frequency !== 1 && frequency !== 2 && frequency !== 4) return ValueError();
    return Box(CalcPrice(settlement, maturity, rate, yld, redemption, frequency, basis));
  },
});

AddExtendedFunction('YIELD', {
  description: 'Returns the yield on a security that pays periodic interest',
  arguments: [
    { name: 'settlement', description: 'The settlement date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'rate', description: 'The annual coupon rate' },
    { name: 'price', description: 'The price per $100 face value' },
    { name: 'redemption', description: 'The redemption value per $100 face value' },
    { name: 'frequency', description: 'The number of coupon payments per year (1, 2, or 4)' },
    { name: 'basis', description: 'The day count basis (0-4)' },
  ],
  fn: (settlement?: number, maturity?: number, rate?: number, price?: number, redemption?: number, frequency?: number, basis?: number): UnionValue => {
    if (settlement === undefined || maturity === undefined || rate === undefined || price === undefined || redemption === undefined || frequency === undefined || basis === undefined) return ValueError();
    if (settlement >= maturity || rate < 0 || price <= 0 || redemption <= 0) return ValueError();
    if (frequency !== 1 && frequency !== 2 && frequency !== 4) return ValueError();

    const result = BisectionSolve(
      (yld) => CalcPrice(settlement, maturity, rate, yld, redemption, frequency, basis) - price,
      0, 2, 1e-10,
    );
    if (result === undefined) return ValueError();
    return Box(result);
  },
});

AddExtendedFunction('DURATION', {
  description: 'Returns the Macaulay duration of a security',
  arguments: [
    { name: 'settlement', description: 'The settlement date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'coupon', description: 'The annual coupon rate' },
    { name: 'yld', description: 'The annual yield' },
    { name: 'frequency', description: 'The number of coupon payments per year (1, 2, or 4)' },
    { name: 'basis', description: 'The day count basis (0-4)' },
  ],
  fn: (settlement?: number, maturity?: number, coupon?: number, yld?: number, frequency?: number, basis?: number): UnionValue => {
    if (settlement === undefined || maturity === undefined || coupon === undefined || yld === undefined || frequency === undefined || basis === undefined) return ValueError();
    if (settlement >= maturity || coupon < 0 || yld < 0) return ValueError();
    if (frequency !== 1 && frequency !== 2 && frequency !== 4) return ValueError();

    const n = CoupNumValue(settlement, maturity, frequency);
    const coup_days = CoupDaysInPeriod(settlement, maturity, frequency, basis);
    const days_bs = CoupDaysBs(settlement, maturity, frequency, basis);
    const dsc_frac = (coup_days - days_bs) / coup_days;
    const c = 100 * coupon / frequency;
    const yf = 1 + yld / frequency;

    let weighted_pv = 0;
    let total_pv = 0;

    for (let k = 1; k <= n; k++) {
      const t = (k - 1 + dsc_frac) / frequency;
      const disc = Math.pow(yf, -(k - 1 + dsc_frac));
      const cf = k < n ? c : c + 100;
      weighted_pv += t * cf * disc;
      total_pv += cf * disc;
    }

    return Box(weighted_pv / total_pv);
  },
});

AddExtendedFunction('MDURATION', {
  description: 'Returns the modified Macaulay duration of a security',
  arguments: [
    { name: 'settlement', description: 'The settlement date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'coupon', description: 'The annual coupon rate' },
    { name: 'yld', description: 'The annual yield' },
    { name: 'frequency', description: 'The number of coupon payments per year (1, 2, or 4)' },
    { name: 'basis', description: 'The day count basis (0-4)' },
  ],
  fn: (settlement?: number, maturity?: number, coupon?: number, yld?: number, frequency?: number, basis?: number): UnionValue => {
    if (settlement === undefined || maturity === undefined || coupon === undefined || yld === undefined || frequency === undefined || basis === undefined) return ValueError();
    if (settlement >= maturity || coupon < 0 || yld < 0) return ValueError();
    if (frequency !== 1 && frequency !== 2 && frequency !== 4) return ValueError();

    const n = CoupNumValue(settlement, maturity, frequency);
    const coup_days = CoupDaysInPeriod(settlement, maturity, frequency, basis);
    const days_bs = CoupDaysBs(settlement, maturity, frequency, basis);
    const dsc_frac = (coup_days - days_bs) / coup_days;
    const c = 100 * coupon / frequency;
    const yf = 1 + yld / frequency;

    let weighted_pv = 0;
    let total_pv = 0;

    for (let k = 1; k <= n; k++) {
      const t = (k - 1 + dsc_frac) / frequency;
      const disc = Math.pow(yf, -(k - 1 + dsc_frac));
      const cf = k < n ? c : c + 100;
      weighted_pv += t * cf * disc;
      total_pv += cf * disc;
    }

    return Box(weighted_pv / total_pv / (1 + yld / frequency));
  },
});

AddExtendedFunction('PRICEMAT', {
  description: 'Returns the price per $100 face value of a security that pays interest at maturity',
  arguments: [
    { name: 'settlement', description: 'The settlement date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'issue', description: 'The issue date' },
    { name: 'rate', description: 'The annual interest rate' },
    { name: 'yld', description: 'The annual yield' },
    { name: 'basis', description: 'The day count basis (0-4)' },
  ],
  fn: (settlement?: number, maturity?: number, issue?: number, rate?: number, yld?: number, basis?: number): UnionValue => {
    if (settlement === undefined || maturity === undefined || issue === undefined || rate === undefined || yld === undefined || basis === undefined) return ValueError();
    if (settlement >= maturity || issue > settlement) return ValueError();

    const yf_im = YearFrac(issue, maturity, basis);
    const yf_is = YearFrac(issue, settlement, basis);
    const yf_sm = YearFrac(settlement, maturity, basis);

    return Box(100 * (1 + rate * yf_im) / (1 + yld * yf_sm) - 100 * rate * yf_is);
  },
});

AddExtendedFunction('YIELDMAT', {
  description: 'Returns the annual yield of a security that pays interest at maturity',
  arguments: [
    { name: 'settlement', description: 'The settlement date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'issue', description: 'The issue date' },
    { name: 'rate', description: 'The annual interest rate' },
    { name: 'price', description: 'The price per $100 face value' },
    { name: 'basis', description: 'The day count basis (0-4)' },
  ],
  fn: (settlement?: number, maturity?: number, issue?: number, rate?: number, price?: number, basis?: number): UnionValue => {
    if (settlement === undefined || maturity === undefined || issue === undefined || rate === undefined || price === undefined || basis === undefined) return ValueError();
    if (settlement >= maturity || issue > settlement || price <= 0) return ValueError();

    const yf_im = YearFrac(issue, maturity, basis);
    const yf_is = YearFrac(issue, settlement, basis);
    const yf_sm = YearFrac(settlement, maturity, basis);

    return Box(((1 + rate * yf_im) / (price / 100 + rate * yf_is) - 1) / yf_sm);
  },
});
