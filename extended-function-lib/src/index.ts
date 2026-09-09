
// extended function library.
//
// each module in ./src exports (as its default export) a map of function name
// to function descriptor. this file imports those maps and merges them into a
// single composite map, `ExtendedFunctions`. alias pairs are exported separately
// as `ExtendedFunctionAliases`.
//
// a consumer registers these explicitly (rather than relying on an import
// side-effect), e.g. by iterating the map and calling the calculator's
// registration method, and applying the aliases afterwards.

import type { FunctionMap } from 'treb-calculator';

// import './template'; // example only, not included in the library

import financeDepreciation from './finance-depreciation';
import financeRates from './finance-rates';
import financeIrr from './finance-irr';
import financeCoupon from './finance-coupon';
import financeBondDisc from './finance-bond-disc';
import financeTbill from './finance-tbill';
import financeAccrued from './finance-accrued';
import financeBond from './finance-bond';
import financeOdd from './finance-odd';
import mathTrig from './math-trig';
import mathRoman from './math-roman';
import textBasic from './text-basic';
import mathRounding from './math-rounding';
import mathCombinatorics from './math-combinatorics';
import mathBase from './math-base';
import mathSumx from './math-sumx';
import statsScalar from './stats-scalar';
import statsDescriptive from './stats-descriptive';
import statsRank from './stats-rank';
import statsRegression from './stats-regression';
import engineeringBaseConversion from './engineering-base-conversion';
import engineeringBitwise from './engineering-bitwise';
import datetimeParts from './datetime-parts';
import infoFunctions from './info-functions';
import textFormat from './text-format';
import arrayManipulate from './array-manipulate';
import statsDistBinomial from './stats-dist-binomial';
import statsDistChisq from './stats-dist-chisq';
import statsDistPoisson from './stats-dist-poisson';
import statsDistLognormal from './stats-dist-lognormal';
import statsDistF from './stats-dist-f';
import statsDistHypgeom from './stats-dist-hypgeom';
import statsDistT from './stats-dist-t';
import statsDistExpon from './stats-dist-expon';
import statsDistWeibull from './stats-dist-weibull';
import statsConfidence from './stats-confidence';
import statsZtest from './stats-ztest';
import compatFunctions from './compat-functions';
import aliases from './compat-aliases';

/**
 * composite map of all extended functions (function name -> descriptor).
 *
 * merge order matches the original registration order; on a duplicate name the
 * later entry wins, preserving the previous sequential-registration behaviour.
 */
export const ExtendedFunctions: FunctionMap = {
  ...financeDepreciation,
  ...financeRates,
  ...financeIrr,
  ...financeCoupon,
  ...financeBondDisc,
  ...financeTbill,
  ...financeAccrued,
  ...financeBond,
  ...financeOdd,
  ...mathTrig,
  ...mathRoman,
  ...textBasic,
  ...mathRounding,
  ...mathCombinatorics,
  ...mathBase,
  ...mathSumx,
  ...statsScalar,
  ...statsDescriptive,
  ...statsRank,
  ...statsRegression,
  ...engineeringBaseConversion,
  ...engineeringBitwise,
  ...datetimeParts,
  ...infoFunctions,
  ...textFormat,
  ...arrayManipulate,
  ...statsDistBinomial,
  ...statsDistChisq,
  ...statsDistPoisson,
  ...statsDistLognormal,
  ...statsDistF,
  ...statsDistHypgeom,
  ...statsDistT,
  ...statsDistExpon,
  ...statsDistWeibull,
  ...statsConfidence,
  ...statsZtest,
  ...compatFunctions,
};

/** alias pairs: [alias_name, target_function_name]. apply after functions. */
export const ExtendedFunctionAliases: [string, string][] = aliases;
