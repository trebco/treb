import { Box, type UnionValue } from 'treb-base-types';
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
