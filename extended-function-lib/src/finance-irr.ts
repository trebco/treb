import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';
import { extractNumbers } from './stats-array-utils';

AddExtendedFunction('MIRR', {
  description: 'Returns the modified internal rate of return for a series of periodic cash flows',
  arguments: [
    { name: 'values', description: 'An array of cash flows', boxed: true },
    { name: 'finance_rate', description: 'The interest rate paid on money used in the cash flows' },
    { name: 'reinvest_rate', description: 'The interest rate received on reinvested cash flows' },
  ],
  fn: (values?: UnionValue, finance_rate?: number, reinvest_rate?: number): UnionValue => {
    if (!values || finance_rate === undefined || reinvest_rate === undefined) return ValueError();
    const flows = extractNumbers(values);
    const n = flows.length;
    if (n < 2) return ValueError();

    let npv_neg = 0;
    let npv_pos = 0;
    let has_neg = false;
    let has_pos = false;

    for (let i = 0; i < n; i++) {
      if (flows[i] < 0) {
        npv_neg += flows[i] / Math.pow(1 + finance_rate, i);
        has_neg = true;
      } else if (flows[i] > 0) {
        npv_pos += flows[i] / Math.pow(1 + reinvest_rate, i);
        has_pos = true;
      }
    }

    if (!has_neg || !has_pos) return ValueError();

    return Box(Math.pow(-npv_pos * Math.pow(1 + reinvest_rate, n - 1) / npv_neg, 1 / (n - 1)) - 1);
  },
});
