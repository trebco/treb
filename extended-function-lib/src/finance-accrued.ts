import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';
import { YearFrac, CoupPcdDate, CoupDaysInPeriod, CoupDaysBs } from './finance-date-utils';

AddExtendedFunction('ACCRINT', {
  description: 'Returns the accrued interest for a security that pays periodic interest',
  arguments: [
    { name: 'issue', description: 'The issue date' },
    { name: 'first_interest', description: 'The first interest date' },
    { name: 'settlement', description: 'The settlement date' },
    { name: 'rate', description: 'The annual coupon rate' },
    { name: 'par', description: 'The par value' },
    { name: 'frequency', description: 'The number of coupon payments per year (1, 2, or 4)' },
    { name: 'basis', description: 'The day count basis (0-4)' },
  ],
  fn: (issue?: number, first_interest?: number, settlement?: number, rate?: number, par?: number, frequency?: number, basis?: number): UnionValue => {
    if (issue === undefined || first_interest === undefined || settlement === undefined || rate === undefined || par === undefined || frequency === undefined || basis === undefined) return ValueError();
    if (issue >= settlement || rate <= 0 || par <= 0) return ValueError();
    if (frequency !== 1 && frequency !== 2 && frequency !== 4) return ValueError();

    const coupon_per_period = par * rate / frequency;
    const pcd = CoupPcdDate(settlement, first_interest, frequency);
    const coup_days = CoupDaysInPeriod(settlement, first_interest, frequency, basis);
    const days_bs = CoupDaysBs(settlement, first_interest, frequency, basis);

    if (pcd >= issue) {
      return Box(coupon_per_period * days_bs / coup_days);
    }

    const first_period_days_from_issue = coup_days - CoupDaysBs(issue, first_interest, frequency, basis) + (coup_days - CoupDaysBs(issue, first_interest, frequency, basis) < 0 ? coup_days : 0);
    return Box(coupon_per_period * (first_period_days_from_issue + days_bs) / coup_days);
  },
});

AddExtendedFunction('ACCRINTM', {
  description: 'Returns the accrued interest for a security that pays interest at maturity',
  arguments: [
    { name: 'issue', description: 'The issue date' },
    { name: 'maturity', description: 'The maturity date' },
    { name: 'rate', description: 'The annual coupon rate' },
    { name: 'par', description: 'The par value' },
    { name: 'basis', description: 'The day count basis (0-4)' },
  ],
  fn: (issue?: number, maturity?: number, rate?: number, par?: number, basis?: number): UnionValue => {
    if (issue === undefined || maturity === undefined || rate === undefined || par === undefined || basis === undefined) return ValueError();
    if (issue >= maturity || rate <= 0 || par <= 0) return ValueError();
    return Box(par * rate * YearFrac(issue, maturity, basis));
  },
});

AddExtendedFunction('AMORLINC', {
  description: 'Returns the depreciation for each accounting period (linear)',
  arguments: [
    { name: 'cost', description: 'The cost of the asset' },
    { name: 'date_purchased', description: 'The date of purchase' },
    { name: 'first_period', description: 'The end date of the first period' },
    { name: 'salvage', description: 'The salvage value' },
    { name: 'period', description: 'The period' },
    { name: 'rate', description: 'The depreciation rate' },
    { name: 'basis', description: 'The day count basis (0-4)' },
  ],
  fn: (cost?: number, date_purchased?: number, first_period?: number, salvage?: number, period?: number, rate?: number, basis?: number): UnionValue => {
    if (cost === undefined || date_purchased === undefined || first_period === undefined || salvage === undefined || period === undefined || rate === undefined || basis === undefined) return ValueError();
    if (cost < 0 || salvage < 0 || rate <= 0 || period < 0) return ValueError();

    const dep_per_period = cost * rate;
    const first_frac = YearFrac(date_purchased, first_period, basis);

    if (period === 0) {
      return Box(cost * rate * first_frac);
    }

    let total_dep = cost * rate * first_frac;
    for (let p = 1; p < period; p++) {
      total_dep += dep_per_period;
    }

    const remaining = cost - salvage - total_dep;
    if (remaining <= 0) return Box(0);
    return Box(Math.min(dep_per_period, remaining));
  },
});
