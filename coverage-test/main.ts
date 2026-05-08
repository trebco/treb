
import { RunAllTests } from '@util';
import { RunReport } from './src/report';
import fs from 'node:fs/promises';

// Math
import './tests/math-basic';
import './tests/math-rounding';
import './tests/math-trig';
import './tests/math-hyperbolic';
import './tests/math-reciprocal-trig';
import './tests/math-logarithmic';
import './tests/math-ceiling-floor';
import './tests/math-combinatorics';
import './tests/math-arithmetic';
import './tests/math-conversion';
import './tests/math-sum';
import './tests/math-sum-conditional';
import './tests/math-sum-paired';
import './tests/math-random';
import './tests/math-matrix';
import './tests/math-sequence';

// Text
import './tests/text-basic';
import './tests/text-search';
import './tests/text-replace';
import './tests/text-format';
import './tests/text-combine';
import './tests/text-extract';
import './tests/text-info';
import './tests/text-regex';
import './tests/text-convert';
import './tests/text-byte';

// Logical
import './tests/logical-basic';
import './tests/logical-switch';
import './tests/logical-lambda';

// Lookup
import './tests/lookup-basic';
import './tests/lookup-vlookup';
import './tests/lookup-address';
import './tests/lookup-search';

import './tests/lookup-filter';
import './tests/lookup-array-reshape';
import './tests/lookup-array-stack';
import './tests/lookup-array-slice';


// Statistical
import './tests/stat-central';
import './tests/stat-conditional';
import './tests/stat-count';
import './tests/stat-minmax';
import './tests/stat-dispersion';
import './tests/stat-deviation';
import './tests/stat-percentile';
import './tests/stat-rank';
import './tests/stat-correlation';
import './tests/stat-regression';
import './tests/stat-forecast';
import './tests/stat-norm';
import './tests/stat-t-dist';
import './tests/stat-chisq-f';
import './tests/stat-f-dist';
import './tests/stat-binom';
import './tests/stat-continuous-dist';
import './tests/stat-other-dist';
import './tests/stat-transform';

// Financial
import './tests/financial-tvm';
import './tests/financial-payment';
import './tests/financial-irr';
import './tests/financial-depreciation';
import './tests/financial-bond';
import './tests/financial-bond2';
import './tests/financial-bond3';
import './tests/financial-coupon';
import './tests/financial-misc';
import './tests/financial-tbill';
import './tests/financial-odd';

// Date & Time
import './tests/date-basic';
import './tests/date-calc';
import './tests/date-workday';
import './tests/date-time';

// Engineering
import './tests/eng-base-convert';
import './tests/eng-base-convert2';
import './tests/eng-bitwise';
import './tests/eng-bessel-error';
import './tests/eng-complex-basic';
import './tests/eng-complex-arith';
import './tests/eng-complex-trig';
import './tests/eng-complex-exp';

// Information
import './tests/info-type-check';
import './tests/info-type-check2';
import './tests/info-cell';

/*
// Database
import './tests/database-aggregate';
import './tests/database-stats';
*/

// Compatibility
import './tests/compat-stat-dist';
import './tests/compat-stat-dist2';
import './tests/compat-stat-norm';
import './tests/compat-stat-basic';
import './tests/compat-stat-var';
import './tests/compat-misc';

/*
// Web
import './tests/web-basic';
*/

let verbose = false;
for (const arg of process.argv) {
  if (arg === '--verbose') {
    verbose = true;
  }
}

const results = await RunAllTests(verbose);
await fs.writeFile('test-results.json', JSON.stringify(results, undefined, 2), { encoding: 'utf-8' });

await RunReport();

