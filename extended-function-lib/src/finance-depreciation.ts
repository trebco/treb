import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { DivideByZeroError, ValueError } from 'treb-calculator';

AddExtendedFunction('SLN', {
  description: 'Returns the straight-line depreciation of an asset for one period',
  arguments: [
    { name: 'cost', description: 'Initial cost of the asset' },
    { name: 'salvage', description: 'Value at the end of the depreciation' },
    { name: 'life', description: 'Number of periods over which the asset is depreciated' },
  ],
  fn: (cost?: number, salvage?: number, life?: number): UnionValue => {
    if (cost === undefined || salvage === undefined || life === undefined) {
      return ValueError();
    }
    if (life === 0) {
      return DivideByZeroError();
    }
    return Box((cost - salvage) / life);
  },
});

AddExtendedFunction('SYD', {
  description: 'Returns the sum-of-years\' digits depreciation of an asset for a specified period',
  arguments: [
    { name: 'cost', description: 'Initial cost of the asset' },
    { name: 'salvage', description: 'Value at the end of the depreciation' },
    { name: 'life', description: 'Number of periods over which the asset is depreciated' },
    { name: 'per', description: 'The period' },
  ],
  fn: (cost?: number, salvage?: number, life?: number, per?: number): UnionValue => {
    if (cost === undefined || salvage === undefined || life === undefined || per === undefined) {
      return ValueError();
    }
    if (life <= 0) {
      return ValueError();
    }
    if (per < 1 || per > life) {
      return ValueError();
    }
    return Box((cost - salvage) * (life - per + 1) * 2 / (life * (life + 1)));
  },
});

AddExtendedFunction('DB', {
  description: 'Returns the depreciation of an asset using the fixed-declining balance method',
  arguments: [
    { name: 'cost', description: 'Initial cost of the asset' },
    { name: 'salvage', description: 'Value at the end of the depreciation' },
    { name: 'life', description: 'Number of periods over which the asset is depreciated' },
    { name: 'period', description: 'The period for which to calculate depreciation' },
    { name: 'month', description: 'Number of months in the first year (default 12)' },
  ],
  fn: (cost?: number, salvage?: number, life?: number, period?: number, month?: number): UnionValue => {
    if (cost === undefined || salvage === undefined || life === undefined || period === undefined) {
      return ValueError();
    }
    if (month === undefined) {
      month = 12;
    }
    month = Math.trunc(month);
    life = Math.trunc(life);
    period = Math.trunc(period);
    if (cost < 0 || salvage < 0 || life < 1 || period < 1 || month < 1 || month > 12) {
      return ValueError();
    }
    const max_period = month < 12 ? life + 1 : life;
    if (period > max_period) {
      return ValueError();
    }
    if (cost === 0) {
      return Box(0);
    }

    const rate = Math.round((1 - Math.pow(salvage / cost, 1 / life)) * 1000) / 1000;
    let total_depreciation = 0;
    let depreciation = 0;

    for (let p = 1; p <= period; p++) {
      if (p === 1) {
        depreciation = cost * rate * month / 12;
      } else if (p === max_period && month < 12) {
        depreciation = (cost - total_depreciation) * rate * (12 - month) / 12;
      } else {
        depreciation = (cost - total_depreciation) * rate;
      }
      total_depreciation += depreciation;
    }

    return Box(depreciation);
  },
});

AddExtendedFunction('DDB', {
  description: 'Returns the depreciation of an asset using the double-declining balance method',
  arguments: [
    { name: 'cost', description: 'Initial cost of the asset' },
    { name: 'salvage', description: 'Value at the end of the depreciation' },
    { name: 'life', description: 'Number of periods over which the asset is depreciated' },
    { name: 'period', description: 'The period for which to calculate depreciation' },
    { name: 'factor', description: 'Rate at which the balance declines (default 2)' },
  ],
  fn: (cost?: number, salvage?: number, life?: number, period?: number, factor?: number): UnionValue => {
    if (cost === undefined || salvage === undefined || life === undefined || period === undefined) {
      return ValueError();
    }
    if (factor === undefined) {
      factor = 2;
    }
    if (cost < 0 || salvage < 0 || life <= 0 || period < 1 || period > life || factor <= 0) {
      return ValueError();
    }

    const rate = factor / life;
    let book_value = cost;
    let depreciation = 0;

    for (let p = 1; p <= period; p++) {
      depreciation = Math.min(book_value * rate, book_value - salvage);
      if (depreciation < 0) {
        depreciation = 0;
      }
      book_value -= depreciation;
    }

    return Box(depreciation);
  },
});
