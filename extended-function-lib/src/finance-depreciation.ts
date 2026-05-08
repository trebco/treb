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

AddExtendedFunction('VDB', {
  description: 'Returns the depreciation of an asset using a variable declining balance method',
  arguments: [
    { name: 'cost', description: 'Initial cost of the asset' },
    { name: 'salvage', description: 'Value at the end of the depreciation' },
    { name: 'life', description: 'Number of periods over which the asset is depreciated' },
    { name: 'start_period', description: 'Starting period for the calculation' },
    { name: 'end_period', description: 'Ending period for the calculation' },
    { name: 'factor', description: 'Rate at which the balance declines (default 2)' },
    { name: 'no_switch', description: 'If true, do not switch to straight-line (default false)' },
  ],
  fn: (cost?: number, salvage?: number, life?: number, start_period?: number, end_period?: number, factor?: number, no_switch?: boolean): UnionValue => {
    if (cost === undefined || salvage === undefined || life === undefined || start_period === undefined || end_period === undefined) {
      return ValueError();
    }
    if (factor === undefined) factor = 2;
    if (no_switch === undefined) no_switch = false;
    if (cost < 0 || salvage < 0 || life <= 0 || start_period < 0 || end_period < start_period || end_period > life || factor <= 0) {
      return ValueError();
    }

    const rate = factor / life;
    let total_dep = 0;
    let book_value = cost;

    for (let p = 1; p <= Math.ceil(end_period); p++) {
      let ddb_dep = book_value * rate;
      let sln_dep = no_switch ? 0 : (book_value - salvage) / (life - p + 1);
      let dep = no_switch ? ddb_dep : Math.max(ddb_dep, sln_dep);
      dep = Math.min(dep, book_value - salvage);
      if (dep < 0) dep = 0;

      const period_start = p - 1;
      const period_end = p;
      const overlap_start = Math.max(period_start, start_period);
      const overlap_end = Math.min(period_end, end_period);

      if (overlap_end > overlap_start) {
        total_dep += dep * (overlap_end - overlap_start);
      }

      book_value -= dep;
    }

    return Box(total_dep);
  },
});
