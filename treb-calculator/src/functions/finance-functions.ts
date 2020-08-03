

import { FunctionMap } from '../descriptors';
import * as Utils from '../utilities';
import { ReferenceError, NotImplError, ValueError } from '../function-error';
import { Cell } from 'treb-base-types';

import { Sparkline } from 'treb-sparkline';

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
    fn: (rate: number, periods: number, pv: number, start: number, end: number, type = 0): number => {
      let accum = 0;
      for (let i = start; i <= end; i++ ) {
        accum += ppmt_function(rate, i, periods, pv, 0, type);
      }
      return accum;
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
    fn: (rate: number, periods: number, pv: number, start: number, end: number, type = 0): number => {
      let accum = 0;
      for (let i = start; i <= end; i++ ) {
        accum += ipmt_function(rate, i, periods, pv, 0, type);
      }
      return accum;
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
    fn: ipmt_function,
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
    fn: ppmt_function,
  },

  Rate: {
    description: 'Returns the interest rate of an annuity',
    arguments: [
      { name: 'Periods', },
      { name: 'Payment', },
      { name: 'Present Value', default: 0 },
      { name: 'Future Value', default: 0 },
      { name: 'Type', default: 0 },
    ],
    fn: (periods: number, payment: number, pv = 0, fv = 0, type = 0): number => {

      let rate = .25; // guess
      let bounds = [0, 1];

      const steps = 32; // max iterations
      const epsilon = 1e-6;

      for (let i = 0; i < steps; i++) {

        const test = payment_function(rate, periods, pv, fv, type);

        if (Math.abs(payment - test) < epsilon) { return rate; }

        if (test < payment) { // reduce rate
          const next_rate = (bounds[0] + rate) / 2;
          bounds = [bounds[0], rate];
          rate = next_rate;
        }
        else { // increase rate
          const next_rate = (bounds[1] + rate) / 2;
          bounds = [rate, bounds[1]];
          rate = next_rate;
        }

      }

      return rate;

    },

  },

  FV: {
    description: 'Returns the future value of an annuity',
    arguments: [
      { name: 'Rate', },
      { name: 'Periods', },
      { name: 'Payment', },
      { name: 'Present Value', default: 0 },
      { name: 'Type', default: 0 },
    ],
    fn: fv_function,
  },

  PV: {
    description: 'Returns the present value of an annuity',
    arguments: [
      { name: 'Rate', },
      { name: 'Periods', },
      { name: 'Payment', },
      { name: 'Future Value', default: 0 },
      { name: 'Type', default: 0 },
    ],
    fn: (rate: number, periods: number, payment: number, fv = 0, type = 0): number => {
      if (type) {
        payment += (fv * (1 / ((1 + rate) * ((Math.pow(1 + rate, periods) -1)/rate))));
        return -(payment + payment / rate * (1 - Math.pow(1 + rate, -(periods - 1))));
      }
      return -(fv + (payment / rate * (Math.pow(1 + rate, periods) - 1))) / Math.pow(1 + rate, periods);
    },
  },

  NPER: {
    description: 'Returns the number of periods of an annuity',
    arguments: [
      { name: 'Rate', },
      { name: 'Payment', },
      { name: 'Present Value', },
      { name: 'Future Value', default: 0 },
      { name: 'Type', default: 0 },
    ],
    fn: (rate :number, payment: number, pv = 0, fv = 0, type = 0): number => {
      if (type) {
        return 1 + (-Math.log(1 + rate * (1 - pv / -payment)) + Math.log(1 + fv * rate / (-payment * (1 + rate)))) / Math.log(1 + rate);
      }
      return (Math.log(Math.pow(1 - pv * rate / -payment, -1)) + Math.log(1 + fv * rate / -payment)) / Math.log(1 + rate);
    },
  },

  PMT: {
    description: 'Returns the periodic payment of an annuity',
    arguments: [
      { name: 'Rate', },
      { name: 'Periods', },
      { name: 'Present Value', },
      { name: 'Future Value', default: 0 },
      { name: 'Type', default: 0 },
    ],
    fn: payment_function,
    /*
    fn: (rate: number, periods: number, pv = 0, fv = 0, type = 0): number => {
      if (type) {
        return -(pv * (rate / (1 - Math.pow(1 + rate, -periods)))) / (1 + rate)
           - (fv * (1 / ((1 + rate) * ((Math.pow(1 + rate, periods) -1)/rate))));
      }
      return -(pv * rate * Math.pow(1 + rate, periods) + fv * rate) / (Math.pow(1 + rate, periods) - 1);
    },
    */
  }

};

