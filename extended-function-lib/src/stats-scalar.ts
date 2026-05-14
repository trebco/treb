import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ValueError } from 'treb-calculator';

// High-precision erf using Cephes rational approximation (~15 digits)
function polevl(x: number, coef: number[]): number {
  let result = coef[0];
  for (let i = 1; i < coef.length; i++) result = result * x + coef[i];
  return result;
}

const T = [9.60497373987051638749e0, 9.00260197203842689217e1, 2.23200534594684319226e3, 7.00332514112805075473e3, 5.55923013010394962768e4];
const U = [1.0, 3.35617141647503099647e1, 5.21357949780152679795e2, 4.59432382970980127987e3, 2.26290000613890934246e4, 4.94730910816827513331e4];
const P = [2.46196981473530512524e-10, 5.64189564831068821977e-1, 7.46321056442269912687e0, 4.86371970985681366614e1, 1.96520832956077098242e2, 5.26445194995477358631e2, 9.34528527171957607540e2, 1.02755188689515710272e3, 5.57535335369399327526e2];
const Q = [1.0, 1.32281951154744992508e1, 8.67072140885989742329e1, 3.54937778887819891062e2, 9.75708501743205489753e2, 1.82390916687909736289e3, 2.24633760818710981792e3, 1.65666309194161350182e3, 5.57535340817727401220e2];
const R = [5.64189583547755073984e-1, 1.27536670759978104416e0, 5.01905042251180477414e0, 6.16021097993053585195e0, 7.40974269950448939160e0, 2.97886665372100240670e0];
const S = [1.0, 2.26052863220117276590e0, 9.39603524938001434673e0, 1.20489539808096656605e1, 1.70814450747565897222e1, 9.60896088305422468066e0, 3.36907645100081462098e0];

function erf(x: number): number {
  if (x === 0) return 0;
  const sign = Math.sign(x);
  const a = Math.abs(x);

  if (a < 0.5) {
    return sign * a * polevl(a * a, T) / polevl(a * a, U);
  }
  if (a < 4) {
    return sign * (1 - Math.exp(-a * a) * polevl(a, P) / polevl(a, Q));
  }
  const inv_a2 = 1 / (a * a);
  return sign * (1 - Math.exp(-a * a) * (polevl(inv_a2, R) / polevl(inv_a2, S)) / a);
}

AddExtendedFunction('STANDARDIZE', {
  description: 'Returns a normalized value',
  arguments: [
    { name: 'x', description: 'The value to normalize', unroll: true },
    { name: 'mean', description: 'The arithmetic mean of the distribution' },
    { name: 'standard_dev', description: 'The standard deviation of the distribution' },
  ],
  fn: (x?: number, mean?: number, stdev?: number): UnionValue => {
    if (x === undefined || mean === undefined || stdev === undefined) return ValueError();
    if (stdev <= 0) return ValueError();
    return Box((x - mean) / stdev);
  },
});

AddExtendedFunction('FISHER', {
  description: 'Returns the Fisher transformation',
  arguments: [
    { name: 'x', description: 'The value for which to compute the transformation', unroll: true },
  ],
  fn: (x?: number): UnionValue => {
    if (x === undefined) return ValueError();
    if (x <= -1 || x >= 1) return ValueError();
    return Box(0.5 * Math.log((1 + x) / (1 - x)));
  },
});

AddExtendedFunction('FISHERINV', {
  description: 'Returns the inverse of the Fisher transformation',
  arguments: [
    { name: 'y', description: 'The value for which to compute the inverse transformation', unroll: true },
  ],
  fn: (y?: number): UnionValue => {
    if (y === undefined) return ValueError();
    const e2y = Math.exp(2 * y);
    return Box((e2y - 1) / (e2y + 1));
  },
});

AddExtendedFunction('PERMUT', {
  description: 'Returns the number of permutations for a given number of objects',
  arguments: [
    { name: 'number', description: 'The total number of objects', unroll: true },
    { name: 'number_chosen', description: 'The number of objects in each permutation' },
  ],
  fn: (n?: number, k?: number): UnionValue => {
    if (n === undefined || k === undefined) return ValueError();
    n = Math.trunc(n);
    k = Math.trunc(k);
    if (n < 0 || k < 0 || k > n) return ValueError();
    let result = 1;
    for (let i = 0; i < k; i++) {
      result *= (n - i);
    }
    return Box(result);
  },
});

AddExtendedFunction('PERMUTATIONA', {
  description: 'Returns the number of permutations with repetitions',
  arguments: [
    { name: 'number', description: 'The total number of objects', unroll: true },
    { name: 'number_chosen', description: 'The number of objects in each permutation' },
  ],
  fn: (n?: number, k?: number): UnionValue => {
    if (n === undefined || k === undefined) return ValueError();
    n = Math.trunc(n);
    k = Math.trunc(k);
    if (n < 0 || k < 0) return ValueError();
    return Box(Math.pow(n, k));
  },
});

AddExtendedFunction('ERF.PRECISE', {
  description: 'Returns the error function integrated between 0 and a limit',
  arguments: [
    { name: 'x', description: 'The upper bound', unroll: true },
  ],
  fn: (x?: number): UnionValue => {
    if (x === undefined) return ValueError();
    return Box(erf(x));
  },
});

AddExtendedFunction('ERFC', {
  description: 'Returns the complementary error function',
  arguments: [
    { name: 'x', description: 'The lower bound', unroll: true },
  ],
  fn: (x?: number): UnionValue => {
    if (x === undefined) return ValueError();
    return Box(1 - erf(x));
  },
});

AddExtendedFunction('ERFC.PRECISE', {
  description: 'Returns the complementary error function',
  arguments: [
    { name: 'x', description: 'The lower bound', unroll: true },
  ],
  fn: (x?: number): UnionValue => {
    if (x === undefined) return ValueError();
    return Box(1 - erf(x));
  },
});

AddExtendedFunction('GAUSS', {
  description: 'Returns the probability that a standard normal population member falls between the mean and z standard deviations from the mean',
  arguments: [
    { name: 'z', description: 'The number of standard deviations from the mean', unroll: true },
  ],
  fn: (z?: number): UnionValue => {
    if (z === undefined) return ValueError();
    return Box(0.5 * erf(z / Math.SQRT2));
  },
});
