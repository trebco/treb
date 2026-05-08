import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { DivideByZeroError, ValueError } from 'treb-calculator';
import { extractNumbers } from './stats-array-utils';

AddExtendedFunction('ISPMT', {
  description: 'Returns the interest paid during a specific period of a loan with even principal payments',
  arguments: [
    { name: 'rate', description: 'The interest rate per period' },
    { name: 'per', description: 'The period for which to find the interest' },
    { name: 'nper', description: 'The total number of payment periods' },
    { name: 'pv', description: 'The present value (loan amount)' },
  ],
  fn: (rate?: number, per?: number, nper?: number, pv?: number): UnionValue => {
    if (rate === undefined || per === undefined || nper === undefined || pv === undefined) {
      return ValueError();
    }
    if (nper === 0) {
      return DivideByZeroError();
    }
    return Box(pv * rate * (per / nper - 1));
  },
});

AddExtendedFunction('EFFECT', {
  description: 'Returns the effective annual interest rate',
  arguments: [
    { name: 'nominal_rate', description: 'The nominal interest rate' },
    { name: 'npery', description: 'The number of compounding periods per year' },
  ],
  fn: (nominal_rate?: number, npery?: number): UnionValue => {
    if (nominal_rate === undefined || npery === undefined) {
      return ValueError();
    }
    if (nominal_rate <= 0) {
      return ValueError();
    }
    npery = Math.trunc(npery);
    if (npery < 1) {
      return ValueError();
    }
    return Box(Math.pow(1 + nominal_rate / npery, npery) - 1);
  },
});

AddExtendedFunction('NOMINAL', {
  description: 'Returns the annual nominal interest rate',
  arguments: [
    { name: 'effect_rate', description: 'The effective interest rate' },
    { name: 'npery', description: 'The number of compounding periods per year' },
  ],
  fn: (effect_rate?: number, npery?: number): UnionValue => {
    if (effect_rate === undefined || npery === undefined) {
      return ValueError();
    }
    if (effect_rate <= 0) {
      return ValueError();
    }
    npery = Math.trunc(npery);
    if (npery < 1) {
      return ValueError();
    }
    return Box(npery * (Math.pow(1 + effect_rate, 1 / npery) - 1));
  },
});

AddExtendedFunction('DOLLARDE', {
  description: 'Converts a dollar price expressed as a fraction into a decimal number',
  arguments: [
    { name: 'fractional_dollar', description: 'A number expressed as an integer part and a fraction part, separated by a decimal point' },
    { name: 'fraction', description: 'The integer to use in the denominator of the fraction' },
  ],
  fn: (fractional_dollar?: number, fraction?: number): UnionValue => {
    if (fractional_dollar === undefined || fraction === undefined) {
      return ValueError();
    }
    if (fraction < 0) {
      return ValueError();
    }
    fraction = Math.trunc(fraction);
    if (fraction < 1) {
      return DivideByZeroError();
    }
    const int_part = Math.trunc(fractional_dollar);
    const dec_part = fractional_dollar - int_part;
    const n = Math.ceil(Math.log10(fraction));
    const power = Math.pow(10, n);
    return Box(int_part + (dec_part * power) / fraction);
  },
});

AddExtendedFunction('DOLLARFR', {
  description: 'Converts a dollar price expressed as a decimal number into a fraction',
  arguments: [
    { name: 'decimal_dollar', description: 'A decimal number' },
    { name: 'fraction', description: 'The integer to use in the denominator of the fraction' },
  ],
  fn: (decimal_dollar?: number, fraction?: number): UnionValue => {
    if (decimal_dollar === undefined || fraction === undefined) {
      return ValueError();
    }
    if (fraction < 0) {
      return ValueError();
    }
    fraction = Math.trunc(fraction);
    if (fraction < 1) {
      return DivideByZeroError();
    }
    const int_part = Math.trunc(decimal_dollar);
    const dec_part = decimal_dollar - int_part;
    const n = Math.ceil(Math.log10(fraction));
    const power = Math.pow(10, n);
    return Box(int_part + (dec_part * fraction) / power);
  },
});

AddExtendedFunction('PDURATION', {
  description: 'Returns the number of periods required by an investment to reach a specified value',
  arguments: [
    { name: 'rate', description: 'The interest rate per period' },
    { name: 'pv', description: 'The present value of the investment' },
    { name: 'fv', description: 'The desired future value of the investment' },
  ],
  fn: (rate?: number, pv?: number, fv?: number): UnionValue => {
    if (rate === undefined || pv === undefined || fv === undefined) {
      return ValueError();
    }
    if (rate <= 0 || pv <= 0 || fv <= 0) {
      return ValueError();
    }
    return Box((Math.log(fv) - Math.log(pv)) / Math.log(1 + rate));
  },
});

AddExtendedFunction('RRI', {
  description: 'Returns an equivalent interest rate for the growth of an investment',
  arguments: [
    { name: 'nper', description: 'The number of periods for the investment' },
    { name: 'pv', description: 'The present value of the investment' },
    { name: 'fv', description: 'The future value of the investment' },
  ],
  fn: (nper?: number, pv?: number, fv?: number): UnionValue => {
    if (nper === undefined || pv === undefined || fv === undefined) {
      return ValueError();
    }
    if (nper <= 0) {
      return ValueError();
    }
    if (pv === 0) {
      return DivideByZeroError();
    }
    return Box(Math.pow(fv / pv, 1 / nper) - 1);
  },
});

AddExtendedFunction('FVSCHEDULE', {
  description: 'Returns the future value of an initial principal after applying a series of compound interest rates',
  arguments: [
    { name: 'principal', description: 'The present value' },
    { name: 'schedule', description: 'An array of interest rates to apply', boxed: true },
  ],
  fn: (principal?: number, schedule?: UnionValue): UnionValue => {
    if (principal === undefined || !schedule) return ValueError();
    const rates = extractNumbers(schedule);
    if (rates.length === 0) return ValueError();
    let result = principal;
    for (const rate of rates) {
      result *= (1 + rate);
    }
    return Box(result);
  },
});
