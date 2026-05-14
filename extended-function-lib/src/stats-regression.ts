import { Box, type UnionValue } from 'treb-base-types';
import { ValueType } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { DivideByZeroError, ValueError } from 'treb-calculator';
import { extractNumbers, extractNumberPairs, mean } from './stats-array-utils';

function linearRegression(xs: number[], ys: number[]): { slope: number; intercept: number; meanX: number; meanY: number } {
  const n = xs.length;
  const mx = mean(xs);
  const my = mean(ys);
  let ssxy = 0;
  let ssxx = 0;
  for (let i = 0; i < n; i++) {
    ssxy += (xs[i] - mx) * (ys[i] - my);
    ssxx += (xs[i] - mx) * (xs[i] - mx);
  }
  const slope = ssxy / ssxx;
  const intercept = my - slope * mx;
  return { slope, intercept, meanX: mx, meanY: my };
}

AddExtendedFunction('PEARSON', {
  description: 'Returns the Pearson product moment correlation coefficient',
  arguments: [
    { name: 'array1', description: 'First set of values', boxed: true },
    { name: 'array2', description: 'Second set of values', boxed: true },
  ],
  fn: (a?: UnionValue, b?: UnionValue): UnionValue => {
    if (!a || !b) return ValueError();
    const pairs = extractNumberPairs(a, b);
    if (!pairs) return ValueError();
    const [xs, ys] = pairs;
    const n = xs.length;
    const mx = mean(xs);
    const my = mean(ys);
    let ssxy = 0, ssxx = 0, ssyy = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - mx;
      const dy = ys[i] - my;
      ssxy += dx * dy;
      ssxx += dx * dx;
      ssyy += dy * dy;
    }
    const denom = Math.sqrt(ssxx * ssyy);
    if (denom === 0) return DivideByZeroError();
    return Box(ssxy / denom);
  },
});

AddExtendedFunction('RSQ', {
  description: 'Returns the square of the Pearson correlation coefficient',
  arguments: [
    { name: 'known_y', description: 'Dependent values', boxed: true },
    { name: 'known_x', description: 'Independent values', boxed: true },
  ],
  fn: (a?: UnionValue, b?: UnionValue): UnionValue => {
    if (!a || !b) return ValueError();
    const pairs = extractNumberPairs(a, b);
    if (!pairs) return ValueError();
    const [ys, xs] = pairs;
    const n = xs.length;
    const mx = mean(xs);
    const my = mean(ys);
    let ssxy = 0, ssxx = 0, ssyy = 0;
    for (let i = 0; i < n; i++) {
      const dx = xs[i] - mx;
      const dy = ys[i] - my;
      ssxy += dx * dy;
      ssxx += dx * dx;
      ssyy += dy * dy;
    }
    const denom = ssxx * ssyy;
    if (denom === 0) return DivideByZeroError();
    return Box((ssxy * ssxy) / denom);
  },
});

AddExtendedFunction('COVARIANCE.P', {
  description: 'Returns population covariance',
  arguments: [
    { name: 'array1', description: 'First set of values', boxed: true },
    { name: 'array2', description: 'Second set of values', boxed: true },
  ],
  fn: (a?: UnionValue, b?: UnionValue): UnionValue => {
    if (!a || !b) return ValueError();
    const pairs = extractNumberPairs(a, b);
    if (!pairs) return ValueError();
    const [xs, ys] = pairs;
    const mx = mean(xs);
    const my = mean(ys);
    let sum = 0;
    for (let i = 0; i < xs.length; i++) {
      sum += (xs[i] - mx) * (ys[i] - my);
    }
    return Box(sum / xs.length);
  },
});

AddExtendedFunction('COVARIANCE.S', {
  description: 'Returns sample covariance',
  arguments: [
    { name: 'array1', description: 'First set of values', boxed: true },
    { name: 'array2', description: 'Second set of values', boxed: true },
  ],
  fn: (a?: UnionValue, b?: UnionValue): UnionValue => {
    if (!a || !b) return ValueError();
    const pairs = extractNumberPairs(a, b);
    if (!pairs) return ValueError();
    const [xs, ys] = pairs;
    if (xs.length < 2) return DivideByZeroError();
    const mx = mean(xs);
    const my = mean(ys);
    let sum = 0;
    for (let i = 0; i < xs.length; i++) {
      sum += (xs[i] - mx) * (ys[i] - my);
    }
    return Box(sum / (xs.length - 1));
  },
});

AddExtendedFunction('STEYX', {
  description: 'Returns the standard error of the predicted y-value for each x in a regression',
  arguments: [
    { name: 'known_y', description: 'Dependent values', boxed: true },
    { name: 'known_x', description: 'Independent values', boxed: true },
  ],
  fn: (known_y?: UnionValue, known_x?: UnionValue): UnionValue => {
    if (!known_y || !known_x) return ValueError();
    const pairs = extractNumberPairs(known_y, known_x);
    if (!pairs) return ValueError();
    const [ys, xs] = pairs;
    const n = xs.length;
    if (n < 3) return DivideByZeroError();
    const reg = linearRegression(xs, ys);
    let sse = 0;
    for (let i = 0; i < n; i++) {
      const predicted = reg.slope * xs[i] + reg.intercept;
      const err = ys[i] - predicted;
      sse += err * err;
    }
    return Box(Math.sqrt(sse / (n - 2)));
  },
});

function DefaultXs(n: number): number[] {
  const xs: number[] = [];
  for (let i = 1; i <= n; i++) xs.push(i);
  return xs;
}

function ExtractOrDefault(v: UnionValue | undefined, n: number): number[] | null {
  if (!v || v.type === ValueType.undefined) return DefaultXs(n);
  const nums = extractNumbers(v);
  return nums.length === n ? nums : null;
}

AddExtendedFunction('LINEST', {
  description: 'Returns the statistics for a least-squares linear fit',
  arguments: [
    { name: 'known_y', description: 'Known y values', boxed: true },
    { name: 'known_x', description: 'Known x values', boxed: true },
  ],
  fn: (known_y?: UnionValue, known_x?: UnionValue): UnionValue => {
    if (!known_y) return ValueError();
    const ys = extractNumbers(known_y);
    if (ys.length === 0) return ValueError();

    const xs = ExtractOrDefault(known_x, ys.length);
    if (!xs) return ValueError();

    const reg = linearRegression(xs, ys);
    return { type: ValueType.array, value: [[Box(reg.slope)], [Box(reg.intercept)]] };
  },
});

AddExtendedFunction('LOGEST', {
  description: 'Returns the statistics for an exponential curve fit',
  arguments: [
    { name: 'known_y', description: 'Known y values', boxed: true },
    { name: 'known_x', description: 'Known x values', boxed: true },
  ],
  fn: (known_y?: UnionValue, known_x?: UnionValue): UnionValue => {
    if (!known_y) return ValueError();
    const ys = extractNumbers(known_y);
    if (ys.length === 0) return ValueError();

    for (const y of ys) {
      if (y <= 0) return ValueError();
    }

    const xs = ExtractOrDefault(known_x, ys.length);
    if (!xs) return ValueError();

    const ln_ys = ys.map(y => Math.log(y));
    const reg = linearRegression(xs, ln_ys);
    return { type: ValueType.array, value: [[Box(Math.exp(reg.slope))], [Box(Math.exp(reg.intercept))]] };
  },
});

AddExtendedFunction('TREND', {
  description: 'Returns values along a linear trend',
  arguments: [
    { name: 'known_y', description: 'Known y values', boxed: true },
    { name: 'known_x', description: 'Known x values', boxed: true },
    { name: 'new_x', description: 'New x values for prediction', boxed: true },
  ],
  fn: (known_y?: UnionValue, known_x?: UnionValue, new_x?: UnionValue): UnionValue => {
    if (!known_y) return ValueError();
    const ys = extractNumbers(known_y);
    if (ys.length === 0) return ValueError();

    const xs = ExtractOrDefault(known_x, ys.length);
    if (!xs) return ValueError();

    let new_xs: number[];
    if (new_x && new_x.type !== ValueType.undefined) {
      new_xs = extractNumbers(new_x);
      if (new_xs.length === 0) return ValueError();
    } else {
      new_xs = xs;
    }

    const reg = linearRegression(xs, ys);
    const col: UnionValue[] = new_xs.map(x => Box(reg.slope * x + reg.intercept));
    return { type: ValueType.array, value: [col] };
  },
});

AddExtendedFunction('GROWTH', {
  description: 'Returns values along an exponential trend',
  arguments: [
    { name: 'known_y', description: 'Known y values', boxed: true },
    { name: 'known_x', description: 'Known x values', boxed: true },
    { name: 'new_x', description: 'New x values for prediction', boxed: true },
  ],
  fn: (known_y?: UnionValue, known_x?: UnionValue, new_x?: UnionValue): UnionValue => {
    if (!known_y) return ValueError();
    const ys = extractNumbers(known_y);
    if (ys.length === 0) return ValueError();

    for (const y of ys) {
      if (y <= 0) return ValueError();
    }

    const xs = ExtractOrDefault(known_x, ys.length);
    if (!xs) return ValueError();

    let new_xs: number[];
    if (new_x && new_x.type !== ValueType.undefined) {
      new_xs = extractNumbers(new_x);
      if (new_xs.length === 0) return ValueError();
    } else {
      new_xs = xs;
    }

    const ln_ys = ys.map(y => Math.log(y));
    const reg = linearRegression(xs, ln_ys);
    const col: UnionValue[] = new_xs.map(x => Box(Math.exp(reg.intercept + reg.slope * x)));
    return { type: ValueType.array, value: [col] };
  },
});
