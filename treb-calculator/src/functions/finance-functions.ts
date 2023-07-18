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
 * Copyright 2022-2023 trebco, llc. 
 * info@treb.app
 * 
 */

import type { FunctionMap } from '../descriptors';
import { type CellValue, type UnionValue, ValueType } from 'treb-base-types';
import { FlattenUnboxed } from '../utilities';

import { ArgumentError, ReferenceError, UnknownError, ValueError, ExpressionError, NAError, DivideByZeroError } from '../function-error';

// use a single, static object for base functions

/**
 * some random web resources, more or less helpful:
 * 
 * http://www.ultimatecalculators.com/future_value_annuity_calculator.html
 * https://financeformulas.net/Annuity-Due-Payment-from-Present-Value.html
 * http://www.tvmcalcs.com/tvm/formulas/regular_annuity_formulas
 */

/**
 * this function is broken out because we use it in the rate function 
 * (to search). we could reasonably use any of them (we probably should 
 * use the one most likely to be zero -- FV maybe?)
 * 
 * this is now used in a couple of functions, so it makes sense to leave
 * it broken out irrespective of what we use for Rate.
 * 
 */
const payment_function = (rate: number, periods: number, pv = 0, fv = 0, type = 0): number => {
  if (type) {
    return -(pv * (rate / (1 - Math.pow(1 + rate, -periods)))) / (1 + rate)
       - (fv * (1 / ((1 + rate) * ((Math.pow(1 + rate, periods) -1)/rate))));
  }
  return -(pv * rate * Math.pow(1 + rate, periods) + fv * rate) / (Math.pow(1 + rate, periods) - 1);
}

/** broken out for use in ipmt, ppmt functions */
const fv_function = (rate: number, periods: number, payment: number, pv = 0, type = 0): number => {
  if (type) {
    return (1 + rate) * -payment / rate * (Math.pow(1 + rate, periods) - 1) - pv * Math.pow(1 + rate, periods);
  }
  return -payment / rate * (Math.pow(1 + rate, periods) - 1) - pv * Math.pow(1 + rate, periods);
};

/** ppmt is calculated as payment less interest payment */
const ipmt_function = (rate: number, period: number, periods: number, pv = 0, fv = 0, type = 0): number => {

  // invalid
  if (period < 1) { return NaN; }

  // if payment is at the start of the period, there's no interest in payment 1
  if (period === 1 && type) {
    return 0;
  }

  const total_payment = payment_function(rate, periods, pv, fv, type);
  const interest = fv_function(rate, period - 1, total_payment, pv, type) * rate;

  // for payments at start of period, after period 1, we need to discount
  return type ? interest / (1 + rate) : interest;

};

const ppmt_function = (rate: number, period: number, periods: number, pv = 0, fv = 0, type = 0): number => {
  return payment_function(rate, periods, pv, fv, type) -
    ipmt_function(rate, period, periods, pv, fv, type);
};

export const FinanceFunctionLibrary: FunctionMap = {

  /**
   * Excel's NPV function is somewhat broken because it assumes the first
   * (usually negative) cashflow is in year 1, not year 0. so the thing to
   * do is just use it on the future cashflows and add the initial outlay
   * as a scalar value.
   */
  NPV: {
    description: 'Returns the present value of a series of future cashflows',
    arguments: [
      { name: 'Rate' },
      { name: 'Cashflow' },
    ],
    fn: (rate = 0, ...args: any[]): UnionValue => {

      let result = 0;

      const flat = FlattenUnboxed(args);
      for (let i = 0; i < flat.length; i++) {
        const arg = flat[i];
        if (typeof arg === 'number') {
          result += Math.pow(1 + rate, -(i + 1)) * arg;
        }
      }
      
      return {
        type: ValueType.number, value: result,
      }
    }
  },

  XIRR: {
    arguments: [
      { name: 'Values', },
      { name: 'Dates', },
      { name: 'Guess', default: .1 },
    ],
    fn: (input_values: CellValue[], input_dates: CellValue[], guess = .1): UnionValue => {

      input_values = FlattenUnboxed(input_values);
      input_dates = FlattenUnboxed(input_dates);

      // some validation...

      if (input_values.length !== input_dates.length) {
        return ArgumentError();
      }

      let positive = 0;
      let negative = 0;

      const values: number[] = [];

      for (const value of input_values) {
        if (typeof value !== 'number') {
          // console.info('value not number', value);
          return ArgumentError();
        }
        if (value > 0) { positive++; }
        if (value < 0) { negative++; }

        values.push(value);
      }

      if (positive <= 0 || negative <= 0) {
        // console.info('invalid -/+ count', positive, negative);
        return ArgumentError();
      }

      const dates: number[] = [];

      //
      // "Numbers in dates are truncated to integers."
      //
      // https://support.microsoft.com/en-gb/office/xirr-function-de1242ec-6477-445b-b11b-a303ad9adc9d
      //
      // what does that mean? rounded? floored? going to assume the latter...

      for (const date of input_dates) {
        if (typeof date !== 'number') {
          return ArgumentError();
        }
        dates.push(Math.floor(date));
      }

      const start = dates[0];
      for (const date of dates) {
        if (date < start) {
          return ArgumentError(); 
        }
      }

      // per the above reference link we have max steps = 100 and 
      // resolution threshold = 1e-8 ("0.000001 percent")

      const step = .1; // initial step

      const bounds = [
        {found: false, value: 0},
        {found: false, value: 0},
      ];

      const count = values.length;

      for (let i = 0; i < 100; i++) {

        // calculate npv
        let npv = 0;
        
        for (let j = 0; j < count; j++) { 
          npv += (values[j] || 0) / Math.pow((1 + guess), (dates[j] - dates[0]) / 365);
        }

        if (Math.abs(npv) <= 1e-6) { // resolution
          // console.info(`** found in ${i + 1} steps`)
          return {
            type: ValueType.number,
            value: guess,
          }
        }

        // search space is unbounded, unfortunately. we can expand exponentially
        // until we have bounds, at which point it's a standard bounded binary search

        // ...or we can expand linearly, using a reasonable initial step size?

        if (npv > 0) {
          bounds[0].value = bounds[0].found ? Math.max(bounds[0].value, guess) : guess;
          bounds[0].found = true;
          if (!bounds[1].found) {
            guess += step;
            continue;
          }
        }
        else {
          bounds[1].value = bounds[1].found ? Math.min(bounds[1].value, guess) : guess;
          bounds[1].found = true;
          if (!bounds[0].found) {
            guess -= step;
            continue;
          }
        }

        guess = bounds[0].value + (bounds[1].value - bounds[0].value) / 2;

      }
      
      return ValueError();

    },
  },

  IRR: {
    description: 'Calculates the internal rate of return of a series of cashflows',
    arguments: [
      { name: 'Cashflows' },
      { name: 'Guess', default: .1 },
    ],
    fn: (args: CellValue[], guess = .1): UnionValue => {

      const flat = FlattenUnboxed(args).map(value => typeof value === 'number' ? value : 0);

      const step = .1; // initial step

      const bounds = [
        {found: false, value: 0},
        {found: false, value: 0},
      ];

      // FIXME: parameterize max step count, resolution?

      for (let i = 0; i < 50; i++) {

        // calculate npv
        let npv = 0;
        for (let j = 0; j < flat.length; j++) { npv += Math.pow(1 + guess, -(j + 1)) * flat[j]; }

        if (Math.abs(npv) <= 0.00125) { // resolution
          // console.info(`** found in ${i + 1} steps`)
          return {
            type: ValueType.number,
            value: guess,
          }
        }

        // search space is unbounded, unfortunately. we can expand exponentially
        // until we have bounds, at which point it's a standard bounded binary search

        // ...or we can expand linearly, using a reasonable initial step size?

        if (npv > 0) {
          bounds[0].value = bounds[0].found ? Math.max(bounds[0].value, guess) : guess;
          bounds[0].found = true;
          if (!bounds[1].found) {
            guess += step;
            continue;
          }
        }
        else {
          bounds[1].value = bounds[1].found ? Math.min(bounds[1].value, guess) : guess;
          bounds[1].found = true;
          if (!bounds[0].found) {
            guess -= step;
            continue;
          }
        }

        guess = bounds[0].value + (bounds[1].value - bounds[0].value) / 2;

      }

      return {
        type: ValueType.error,
        value: 'NUM',
      }
    },
  },

  CUMPRINC: {
    description: 'Returns cumulative principal paid on a loan between two periods',
    arguments: [
      { name: 'Rate', },
      { name: 'Periods', },
      { name: 'Present Value' },
      { name: 'Start Period' },
      { name: 'End Period' },
      { name: 'Type', default: 0 },
    ],
    fn: (rate: number, periods: number, pv: number, start: number, end: number, type = 0): UnionValue => {
      let accum = 0;
      for (let i = start; i <= end; i++ ) {
        accum += ppmt_function(rate, i, periods, pv, 0, type);
      }
      return { type: ValueType.number, value: accum };
    },

  },

  CUMIPMT: {
    description: 'Returns cumulative interest paid on a loan between two periods',
    arguments: [
      { name: 'Rate', },
      { name: 'Periods', },
      { name: 'Present Value' },
      { name: 'Start Period' },
      { name: 'End Period' },
      { name: 'Type', default: 0 },
    ],
    fn: (rate: number, periods: number, pv: number, start: number, end: number, type = 0): UnionValue => {
      let accum = 0;
      for (let i = start; i <= end; i++ ) {
        accum += ipmt_function(rate, i, periods, pv, 0, type);
      }
      return { type: ValueType.number, value: accum };
    },

  },

  IPMT: {
    description: 'Returns the interest portion of a payment',
    arguments: [
      { name: 'Rate', },
      { name: 'Period', },
      { name: 'Periods', },
      { name: 'Present Value', default: 0 },
      { name: 'Future Value', default: 0 },
      { name: 'Type', default: 0 },
    ],
    fn: (rate: number, period: number, periods: number, pv = 0, fv = 0, type = 0): UnionValue => {
      return { type: ValueType.number, value: ipmt_function(rate, period, periods, pv, fv, type) };
    }
  },

  PPMT: {
    description: 'Returns the principal portion of a payment',
    arguments: [
      { name: 'Rate', },
      { name: 'Period', },
      { name: 'Periods', },
      { name: 'Present Value', default: 0 },
      { name: 'Future Value', default: 0 },
      { name: 'Type', default: 0 },
    ],
    fn: (rate: number, period: number, periods: number, pv = 0, fv = 0, type = 0): UnionValue => {
      return { type: ValueType.number, value: ppmt_function(rate, period, periods, pv, fv, type) };
    }
  },

  Rate: {
    description: 'Returns the interest rate of a loan',
    arguments: [
      { name: 'Periods', },
      { name: 'Payment', },
      { name: 'Present Value', default: 0 },
      { name: 'Future Value', default: 0 },
      { name: 'Type', default: 0 },
    ],
    fn: (periods: number, payment: number, pv = 0, fv = 0, type = 0): UnionValue => {

      let rate = .25; // guess
      const bounds = [-1, 1];

      const steps = 32; // max iterations
      const epsilon = 1e-6;

      for (let i = 0; i < steps; i++) {

        const a = payment_function(rate, periods, pv, fv, type);

        if (Math.abs(a - payment) <= epsilon) {
          return { type: ValueType.number, value: rate };
        }

        const b = payment_function(bounds[1], periods, pv, fv, type);


        if ((payment >= a && payment <= b) || (payment >= b && payment <= a)) {
          bounds[0] = rate;
        }
        else {
          bounds[1] = rate;
        }
        rate = bounds[0] + (bounds[1] - bounds[0]) / 2;

        /*
        const test = payment_function(rate, periods, pv, fv, type);
        console.info("R", rate, "TP", test, payment, "d", Math.abs(payment-test), bounds);

        if (Math.abs(payment - test) < epsilon) { 
          return { type: ValueType.number, value: rate };
        }

        if ((test < payment && payment > 0) || (test > payment && payment < 0)) { // reduce rate
          console.info("T<P");
          const next_rate = (bounds[0] + rate) / 2;
          bounds = [bounds[0], rate];
          rate = next_rate;
        }
        else { // increase rate
          console.info("T>=P");
          const next_rate = (bounds[1] + rate) / 2;
          bounds = [rate, bounds[1]];
          rate = next_rate;
        }
        */

      }

      return { type: ValueType.number, value: rate };

    },

  },

  FV: {
    description: 'Returns the future value of an investment',
    arguments: [
      { name: 'Rate', },
      { name: 'Periods', },
      { name: 'Payment', },
      { name: 'Present Value', default: 0 },
      { name: 'Type', default: 0 },
    ],
    fn: (rate: number, periods: number, payment: number, pv = 0, type = 0): UnionValue => {
      return { type: ValueType.number, value: fv_function(rate, periods, payment, pv, type) };
    },
  },

  PV: {
    description: 'Returns the present value of an investment',
    arguments: [
      { name: 'Rate', },
      { name: 'Periods', },
      { name: 'Payment', },
      { name: 'Future Value', default: 0 },
      { name: 'Type', default: 0 },
    ],
    fn: (rate: number, periods: number, payment: number, fv = 0, type = 0): UnionValue => {
      if (type) {
        payment += (fv * (1 / ((1 + rate) * ((Math.pow(1 + rate, periods) -1)/rate))));
        return {
          type: ValueType.number, 
          value: -(payment + payment / rate * (1 - Math.pow(1 + rate, -(periods - 1))))
        };
      }
      return {
        type: ValueType.number, 
        value: -(fv + (payment / rate * (Math.pow(1 + rate, periods) - 1))) / Math.pow(1 + rate, periods) 
      };
    },
  },

  NPER: {
    description: 'Returns the number of periods of an investment',
    arguments: [
      { name: 'Rate', },
      { name: 'Payment', },
      { name: 'Present Value', },
      { name: 'Future Value', default: 0 },
      { name: 'Type', default: 0 },
    ],
    fn: (rate :number, payment: number, pv = 0, fv = 0, type = 0): UnionValue => {
      if (type) {
        return {
          type: ValueType.number, 
          value: 1 + (-Math.log(1 + rate * (1 - pv / -payment)) + Math.log(1 + fv * rate / (-payment * (1 + rate)))) / Math.log(1 + rate)
        };
      }
      return {
        type: ValueType.number, 
        value: (Math.log(Math.pow(1 - pv * rate / -payment, -1)) + Math.log(1 + fv * rate / -payment)) / Math.log(1 + rate)
      };
    },
  },

  PMT: {
    description: 'Returns the periodic payment of a loan',
    arguments: [
      { name: 'Rate', },
      { name: 'Periods', },
      { name: 'Present Value', },
      { name: 'Future Value', default: 0 },
      { name: 'Type', default: 0 },
    ],
    fn: (rate: number, periods: number, pv: number, fv = 0, type = 0): UnionValue => {
      return { 
        type: ValueType.number, 
        value: payment_function(rate, periods, pv, fv, type),
      };
    },
  }


};

