/* eslint-disable no-unexpected-multiline */

import { /*UnionOrArray,*/ ICellAddress, Cell, UnionValue, ValueType, GetValueType, ArrayUnion, CellValue } from 'treb-base-types';
import * as Utils from 'treb-calculator/src/utilities';
import { Matrix, CDMatrix, MC, Stats, Random } from 'riskampjs-mc';
import { MCFunctionMap } from './descriptors';
import { DataError, ArgumentError, ValueError } from 'treb-calculator/src/function-error';
import { Scale as CreateScale } from 'treb-utils';
import { DataModel } from 'treb-grid';
import { Polynomial } from './polynomial/polynomial';

export type SimulationResultsData =  Array<Float64Array|number[]>[][];

export enum SimulationState {
  Null, Prep, Simulation, Post,
}

interface DistributionKey extends ICellAddress {
  call_index: number;
}

/**
 * scale parameters for discrete pert/triangular
 */
const Discrete3Parameters = (min: number, mode: number, max: number) => {

  // start with integers (jic)

  min = Math.floor(min);
  mode = Math.floor(mode);
  max = Math.floor(max) + 1; // before or after the range? (...)

  mode = (mode + ((mode - min) / (max-min)));

  return [min, mode, max];

};

/**
 * floor data. note we're not using functional methods for performance.
 */
const Discrete = (field: number[]|Float64Array) => {
  for (let i = 0; i < field.length; i++) {
    field[i] = Math.floor(field[i]);
  }
  return field;
};

const ShuffledIntegers = (count: number) => {
  
  const field = MC.Uniform(count);

  const shuffled: number[] = [];
  for (let i = 0; i < count; i++) {
    shuffled[i] = i;
  }

  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(field[i] * (count - i));
    const tmp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = tmp;
  }

  return shuffled;

}

/**
 * class represents a model, including simulation data and functions. the
 * spreadsheet functions refer to an instance of the model, which retains
 * state.
 *
 * FIXME: split state and model so we can have a non-MC model
 *
 * making a non-MC model might require moving some logic in here from
 * the various calculator classes (I think)
 */
export class SimulationModel {

  // I think these two are the only ones we might need outside of
  // simulation/MC functions

  public address: ICellAddress = { row: 0, column: 0 };
  public volatile = false;
  public model?: DataModel;

  // public name_stack: Array<{[index: string]: ExpressionUnit}> = [];

  // the rest are specific to MC, I think

  public iteration = 0;
  public iterations = 0;
  public call_index = 0;
  public lhs = false;
  public state = SimulationState.Null;
  
  public results: SimulationResultsData = []; 
  
  public elapsed = 0;
  public trials = 0;

  public set seed(seed: number) {
    Random.Seed(seed);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  public distributions: any = [];

  public correlated_distributions: {
    [index: string]: {
      addresses: DistributionKey[];

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      correlation: any;
    };
  } = {};

  /**
   * returns a list of functions for registration. would be nice to move
   * this out of the class (it's long) but we need references to the instance.
   *
   * FIXME: not in love with binding everything, although that may be the only
   * way (OR: add a 'target' to the func descriptor, then executor can call
   * against the instance. didn't we do that in the past?)
   *
   * note that if you do that, then you will need a test in every function
   * call (is there a target?) -- or perhaps you could _always_ have a target,
   * just restructure base functions...
   *
   * one nice thing about binding is that it supports composing functions
   * (if we ever do that), without juggling this pointers.
   *
   * NOTE: moved initialization into ctor, since we are potentially calling
   * this more than once. And you could move it out of this file, and use a
   * reference when constructing it. although that would require making various
   * functions public, probably (they are already public, for some reason).
   *
   * alternatively (to moving this to another file) you could consolidate the
   * map and the actual functions. kind of hard to write them in that format,
   * though.
   */
  public readonly functions: MCFunctionMap;

  constructor() {

    this.functions = {

      'Multivariate.Normal': {
        description: 'Returns a sample from the multivariate normal distribution',
        simulation_volatile: true,
        arguments: [
          { name: 'range of values', description: 'Set of Correlated Distributions (N)', address: true },
          { name: 'correlation', description: 'Correlation Matrix (NxN)' },
          { name: 'mean', description: 'Distribution Mean', default: 0 },
          { name: 'stdev', description: 'Standard Deviation', default: 1 },
        ],
        fn: this.multivariate_normal.bind(this),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      'Multivariate.LogNormal': {
        description: 'Returns a sample from the multivariate log-normal distribution',
        simulation_volatile: true,
        arguments: [
          { name: 'range of values', description: 'Set of Correlated Distributions (N)', address: true },
          { name: 'correlation', description: 'Correlation Matrix (NxN)' },
          { name: 'mean', description: 'Mean of underlying Normal distribution', default: 0 },
          { name: 'stdev', description: 'Standard Deviation of underlying Normal distribution', default: 1 },
        ],
        fn: this.multivariate_lognormal.bind(this),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      'Multivariate.Uniform': {
        description: 'Returns a sample from the multivariate uniform distribution',
        simulation_volatile: true,
        arguments: [
          { name: 'range of values', description: 'Set of Correlated Distributions (N)', address: true },
          { name: 'correlation', description: 'Correlation Matrix (NxN)' },
          { name: 'min', description: 'Minimum Value', default: 0 },
          { name: 'max', description: 'Maximum Value', default: 1 },
          // { name: 'discrete', description: 'Discrete', default: false },
        ],
        fn: this.multivariate_uniform.bind(this),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      'Multivariate.Beta': {
        description: 'Returns a sample from the multivariate beta distribution',
        simulation_volatile: true,
        arguments: [
          { name: 'range of values', description: 'Set of Correlated Distributions (N)', address: true },
          { name: 'correlation', description: 'Correlation Matrix (NxN)' },
          { name: 'w', description: 'Shape Parameter' },
          { name: 'v', description: 'Shape Parameter' },
        ],
        fn: this.multivariate_beta.bind(this),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      'Multivariate.PERT': {
        description: 'Returns a sample from the multivariate PERT distribution',
        simulation_volatile: true,
        arguments: [
          { name: 'range of values', description: 'Set of Correlated Distributions (N)', address: true },
          { name: 'correlation', description: 'Correlation Matrix (NxN)' },
          { name: 'min', description: 'Minimum Value' },
          { name: 'mode', description: 'Most-Likely Value' },
          { name: 'max', description: 'Maximum Value' },
          { name: 'lambda', default: 4 },
          // { name: 'discrete', description: 'Discrete', default: false },
        ],
        fn: this.multivariate_pert.bind(this),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      'Multivariate.Triangular': {
        description: 'Returns a sample from the multivariate triangular distribution',
        simulation_volatile: true,
        arguments: [
          { name: 'range of values', description: 'Set of Correlated Distributions (N)', address: true },
          { name: 'correlation', description: 'Correlation Matrix (NxN)' },
          { name: 'min', description: 'Minimum Value' },
          { name: 'mode', description: 'Most-Likely Value' },
          { name: 'max', description: 'Maximum Value' },
          // { name: 'discrete', description: 'Discrete', default: false },
        ],
        fn: this.multivariate_triangular.bind(this),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      // basic distributions

      UniformRangeSample: {
        description: 'Returns one of a set of values, with equal probability and with replacement',
        simulation_volatile: true,
        arguments: [
          { name: 'range', description: 'Range of Values' },
        ],
        fn: this.uniformrangesample.bind(this),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      SampleValue: {
        description: 'Returns one of a set of values, with equal probability and with replacement',
        simulation_volatile: true,
        arguments: [
          { name: 'range', description: 'Range of Values' },
        ],
        fn: this.samplevalue.bind(this),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      'SampleValue.Weighted': {
        description: 'Returns one of a set of values, weighted by a second set of values',
        simulation_volatile: true,
        arguments: [
          { name: 'range', description: 'Range of Values' },
          { name: 'weights', description: 'Range of Weights' },
        ],
        fn: this.samplevalue_weighted.bind(this),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      BernoulliValue: {
        description: 'Returns true or false (boolean) based on the given probability',
        simulation_volatile: true,
        arguments: [
          { name: 'p', description: 'Probability to return True', default: 0.5 },
        ],
        fn: this.bernoullivalue.bind(this),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      ProbabilityValue: {
        description: 'Returns true or false (boolean) based on the given probability',
        simulation_volatile: true,
        arguments: [
          { name: 'p', description: 'Probability to return True', default: 0.5 },
        ],
        fn: this.probabilityvalue.bind(this),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },
     
      UniformValue: {
        description: 'Returns a sample from the uniform distribution',
        simulation_volatile: true,
        arguments: [
          { name: 'min', description: 'Minimum', default: 0 },
          { name: 'max', description: 'Maximum', default: 1 },
        ],
        fn: this.uniformvalue.bind(this, false),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      'UniformValue.Discrete': {
        description: 'Returns a sample from the uniform distribution',
        simulation_volatile: true,
        arguments: [
          { name: 'min', description: 'Minimum', default: 0 },
          { name: 'max', description: 'Maximum', default: 1 },
        ],
        fn: this.uniformvalue.bind(this, true),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      BetaValue: {
        description: 'Returns a sample from the beta distribution',
        simulation_volatile: true,
        arguments: [
          { name: 'w', description: 'Shape Parameter' },
          { name: 'v', description: 'Shape Parameter' },
        ],
        fn: this.betavalue.bind(this),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      BinomialValue: {
        description: 'Returns a sample from the binomial distribution',
        simulation_volatile: true,
        arguments: [
          { name: 'n', description: 'Number of trials', },
          { name: 'p', description: 'Probability of success in each trial', },
        ],
        fn: this.binomialvalue.bind(this),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      NegativeBinomialValue: {
        description: 'Returns a sample from the negative-binomial distribution',
        simulation_volatile: true,
        arguments: [
          { name: 'n', description: 'Target number of successful trials', },
          { name: 'p', description: 'Probability of success in each trial', },
        ],
        fn: this.negativebinomialvalue.bind(this),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      PoisssonValue: {
        description: 'Returns a sample from the poisson distribution',
        simulation_volatile: true,
        arguments: [
          { name: 'm', description: 'Mean', },
        ],
        fn: this.poissonvalue.bind(this),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      TruncatedNormalValue: {
        description: 'Returns a sample from the normal distribution',
        simulation_volatile: true,
        arguments: [
          { name: 'mean', description: 'Mean', default: 0 },
          { name: 'stdev', description: 'Standard Deviation', default: 1 },
          { name: 'min', description: 'Minimum Value' },
          { name: 'max', description: 'Maximum Value' },
        ],
        fn: this.truncatednormalvalue.bind(this),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      NormalValue: {
        description: 'Returns a sample from the normal distribution',
        simulation_volatile: true,
        arguments: [
          { name: 'mean', description: 'Mean', default: 0 },
          { name: 'stdev', description: 'Standard Deviation', default: 1 },
        ],
        fn: this.normalvalue.bind(this),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      PERTValue: {
        description: 'Returns a sample from the beta-PERT distribution',
        simulation_volatile: true,
        arguments: [
          { name: 'min', description: 'Minimum Value', default: 0 },
          { name: 'mode', description: 'Most-Likely Value', default: 0.5 },
          { name: 'max', description: 'Maximum Value', default: 1 },
          { name: 'lambda', default: 4 },
        ],
        fn: this.pertvalue.bind(this, false),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      'PERTValue.Discrete': {
        description: 'Returns a sample from the beta-PERT distribution',
        simulation_volatile: true,
        arguments: [
          { name: 'min', description: 'Minimum Value', default: 0 },
          { name: 'mode', description: 'Most-Likely Value', default: 0.5 },
          { name: 'max', description: 'Maximum Value', default: 1 },
          { name: 'lambda', default: 4 },
        ],
        fn: this.pertvalue.bind(this, true),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      ScaledLognormalValue: {
        description: 'Returns a sample from the log-normal distribution, scaled to the desired mean and standard deviation',
        simulation_volatile: true,
        arguments: [
          { name: 'mean', description: 'Target mean', default: 0 },
          { name: 'stdev', description: 'Standard deviation', default: 1 },
        ],
        fn: this.scaledlognormalvalue.bind(this),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      LognormalValue: {
        description: 'Returns a sample from the log-normal distribution',
        simulation_volatile: true,
        arguments: [
          { name: 'mean', description: 'Mean of underlying Normal distribution', default: 0 },
          { name: 'stdev', description: 'Standard deviation of underlying Normal distribution', default: 1 },
        ],
        fn: this.lognormalvalue.bind(this),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      SequentialValue: {
        description: 'Returns one from a set of values, in order',
        simulation_volatile: true,
        arguments: [
          { name: 'values', description: 'Data Array' },
          { name: 'count', description: 'Count', default: 0 },
        ],
        fn: this.sequentialvalue.bind(this),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      IndexValue: {
        description: 'Returns a monotonically increasing value',
        simulation_volatile: true,
        arguments: [
          { name: 'max', description: 'Maximum', default: 0 },
        ],
        fn: this.indexvalue.bind(this),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      'PERTValue.P': {
        description: 'Returns a sample from the beta-PERT distribution',
        simulation_volatile: true,
        arguments: [
          { name: 'p10', description: '10th-Percentile Value', default: 0 },
          { name: 'mode', description: 'Most-Likely Value', default: 0.5 },
          { name: 'p90', description: '90th-Percentile Value', default: 1 },
          { name: 'lambda', default: 4 },
        ],
        fn: this.pertvalue_p.bind(this),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      TriangularValue: {
        description: 'Returns a sample from the triangular distribution',
        simulation_volatile: true,
        arguments: [
          { name: 'min', description: 'Minimum Value', default: 0 },
          { name: 'mode', description: 'Most Likely Value', default: 0.5 },
          { name: 'max', description: 'Maximum Value', default: 1 },
        ],
        fn: this.triangularvalue.bind(this, false),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      'TriangularValue.Discrete': {
        description: 'Returns a sample from the triangular distribution',
        simulation_volatile: true,
        arguments: [
          { name: 'min', description: 'Minimum Value', default: 0 },
          { name: 'mode', description: 'Most Likely Value', default: 0.5 },
          { name: 'max', description: 'Maximum Value', default: 1 },
        ],
        fn: this.triangularvalue.bind(this, true),
        category: ['RiskAMP Random Distributions'],
        extension: true,
      },

      // stats

      SimulationCorrelationMatrix: {
        description: 'Returns the correlation among a set of data, as a matrix',
        arguments: [
          { name: 'range', description: 'Range of data', collector: true },
          { name: 'full matrix', description: 'Full matrix', default: false },
        ],
        fn: this.simulationcorrelationmatrix.bind(this),
        category: ['RiskAMP Simulation Functions'],
        extension: true,
      },

      SimulationCorrelation: {
        description: 'Returns the correlation between the data from two cells in the simulation',
        arguments: [
          { name: 'reference cell', description: 'Cell 1', collector: true },
          { name: 'reference cell', description: 'Cell 2', collector: true },
        ],
        fn: this.simulationcorrelation.bind(this),
        category: ['RiskAMP Simulation Functions'],
        extension: true,
      },

      SimulationRSquared: {
        // tslint:disable-next-line:max-line-length
        description: 'Returns the r-squared value (coefficient of correlation) of the data from two cells in the simulation',
        arguments: [
          { name: 'dependent', description: 'Dependent Value', collector: true },
          { name: 'independent', description: 'Indepdendent Value', collector: true },
        ],
        fn: this.simulationrsquared.bind(this),
        category: ['RiskAMP Simulation Functions'],
        extension: true,
      },

      SimulationSkewness: {
        description: 'Returns the skewness of data from this cell in the simulation',
        arguments: [
          { name: 'reference cell', description: 'Source Cell', collector: true },
        ],
        fn: this.simulationskewness.bind(this),
        category: ['RiskAMP Simulation Functions'],
        extension: true,
      },

      SimulationKurtosis: {
        description: 'Returns the kurtosis (peakedness) of data from this cell in the simulation',
        arguments: [
          { name: 'reference cell', description: 'Source Cell', collector: true },
        ],
        fn: this.simulationkurtosis.bind(this),
        category: ['RiskAMP Simulation Functions'],
        extension: true,
      },

      SimulationPercentile: {
        description: 'Returns the value of a cell at a given percentile in the simulation',
        arguments: [
          { name: 'reference cell', description: 'Source Cell', collector: true },
          { name: 'percentile', description: 'Percentile (as %)' },
        ],
        fn: this.simulationpercentile.bind(this),
        category: ['RiskAMP Simulation Functions'],
        extension: true,
      },

      SimulationInterval: {
        description: 'Returns the portion of results in the simulation that fall within some bounds (as a percentage)',
        arguments: [
          { name: 'reference cell', description: 'Source Cell', collector: true },
          { name: 'min', description: 'Minimum Value (optional, inclusive)' },
          { name: 'max', description: 'Maximum Value (optional, inclusive)' },
        ],
        fn: this.simulationinterval.bind(this),
        category: ['RiskAMP Simulation Functions'],
        extension: true,
      },

      SimulationMode: {
        description: 'Returns the mode of the data from this cell in the simulation. Use for discrete data only.',
        arguments: [
          { name: 'reference cell', description: 'Source Cell', collector: true },
        ],
        fn: this.simulationmode.bind(this),
        extension: true,
        category: ['RiskAMP Simulation Functions'],
      },

      SimulationMean: {
        description: 'Returns the mean (average) value of the data from this cell in the simulation',
        arguments: [
          { name: 'reference cell', description: 'Source Cell', collector: true },
        ],
        fn: this.simulationmean.bind(this),
        extension: true,
        category: ['RiskAMP Simulation Functions'],
      },

      SimulationMedian: {
        description: 'Returns the median value of the data from this cell in the simulation',
        arguments: [
          { name: 'reference cell', description: 'Source Cell', collector: true },
        ],
        fn: this.simulationmedian.bind(this),
        category: ['RiskAMP Simulation Functions'],
        extension: true,
      },

      SimulationValue: {
        description: 'Returns the value of this cell in the simulation at the given trial number',
        arguments: [
          { name: 'reference cell', description: 'Source Cell', collector: true },
          { name: 'iteration', description: 'Trial Number' },
        ],
        fn: this.simulationvalue.bind(this),
        category: ['RiskAMP Simulation Functions'],
        extension: true,
      },

      'SimulationValue.Cumulative': {
        description: 'Returns the value of this cell in the simulation at the given trial number (cumulative)',
        arguments: [
          { name: 'reference cell', description: 'Source Cell', collector: true },
          { name: 'iteration', description: 'Trial Number' },
        ],
        fn: this.simulationvalue_cumulative.bind(this),
        category: ['RiskAMP Simulation Functions'],
        extension: true,
      },

      SimulationValuesArray: {
        description: 'Returns all values of this cell in the simulation, as an array',
        arguments: [
          { name: 'reference cell', description: 'Source Cell', collector: true },
        ],
        fn: this.simulationvaluesarray.bind(this),
        category: ['RiskAMP Simulation Functions'],
        extension: true,
      },

      SortedSimulationIndex: {
        description: 'Returns the iteration number of a sorted value for this cell',
        arguments: [
          { name: 'reference cell', description: 'Source Cell', collector: true },
          { name: 'index', }
        ],
        fn: this.sortedsimulationindex.bind(this),
        category: ['RiskAMP Simulation Functions'],
        extension: true,
      },

      'SimulationValuesArray.Ordered': {
        description: 'Returns all values of this cell in the simulation, as an array, ordered by a second cell',
        arguments: [
          { name: 'reference cell', description: 'Source Cell', collector: true },
          { name: 'order by', description: 'Reference Cell for Ordering', collector: true },
        ],
        fn: this.simulationvaluesarray_ordered.bind(this),
        category: ['RiskAMP Simulation Functions'],
        extension: true,
      },

      SimulationMin: {
        description: 'Returns the minimum value of the data from this cell in the simulation',
        arguments: [
          { name: 'reference cell', description: 'Source Cell', collector: true },
        ],
        fn: this.simulationmin.bind(this),
        category: ['RiskAMP Simulation Functions'],
        extension: true,
      },

      SimulationMax: {
        description: 'Returns the maximum value of the data from this cell in the simulation',
        arguments: [
          { name: 'reference cell', description: 'Source Cell', collector: true },
        ],
        fn: this.simulationmax.bind(this),
        category: ['RiskAMP Simulation Functions'],
        extension: true,
      },

      SimulationStandardError: {
        description: 'Returns the standard error of the mean from this cell in the simulation',
        arguments: [
          { name: 'reference cell', collector: true },
        ],
        fn: this.simulationstandarderror.bind(this),
        category: ['RiskAMP Simulation Functions'],
        extension: true,
      },

      SimulationStandardDeviation: {
        description: 'Returns the standard deviation of the data from this cell in the simulation',
        arguments: [
          { name: 'reference cell', description: 'Source Cell', collector: true },
        ],
        fn: this.simulationstandarddeviation.bind(this),
        category: ['RiskAMP Simulation Functions'],
        extension: true,
      },

      SimulationVariance: {
        description: 'Returns the variance of the data from this cell in the simulation',
        arguments: [
          { name: 'reference cell', description: 'Source Cell', collector: true },
        ],
        fn: this.simulationvariance.bind(this),
        category: ['RiskAMP Simulation Functions'],
        extension: true,
      },

      // special

      SimulationTrials: {
        description: 'Returns the number of trials from the last simulation',
        fn: this.simulationtrials.bind(this),
        category: ['RiskAMP Simulation Functions'],
        extension: true,
      },

      SimulationTime: {
        description: 'Returns the elapsed time of the last simulation',
        fn: this.simulationtime.bind(this),
        category: ['RiskAMP Simulation Functions'],
        extension: true,
      },

      // some extra random functions, available because we have the matrix classes

      IsPosDef: {
        description: 'Checks that a matrix is positive-definite',
        arguments: [{ name: 'matrix' }],
        fn: (mat: number[][]): UnionValue => {
          if (mat.some((arr) => {
            return arr.some((v) => typeof v !== 'number');
          })) return ValueError();
          const m = Matrix.FromArray(mat);
          return { type: ValueType.boolean, value: m.IsPosDef() };
        },
        extension: true,
      },

      MakePosDef: {
        description: 'Returns a matrix that is positive-definite',
        arguments: [{ name: 'matrix' }],
        fn: (mat: number[][]): UnionValue => {
          
          if (mat.some((arr) => {
            return arr.some((v) => typeof v !== 'number');
          })) return ValueError();
          
          const m = Matrix.FromArray(mat).MakePosDef().ToArray();

          return {
            type: ValueType.array,
            value: m.map(row => row.map(value => {
              return {
                type: ValueType.number,
                value,
              };
            })),
          };

        },
        extension: true,
      },

      Cholesky: {
        arguments: [{ name: 'matrix' }, { name: 'transpose', default: false }],
        fn: (mat: number[][], transpose = false) => {
          const m = Matrix.FromArray(mat).Cholesky(transpose).ToArray();

          return {
            type: ValueType.array,
            value: m.map(row => row.map(value => {
              return {
                type: ValueType.number,
                value,
              };
            })),
          };

          /*
          return m.map(row => row.map(value => {
            return {
              type: ValueType.number,
              value,
            };
          }));
          */
        },
        extension: true,
      },

      EigenValues: {
        description: 'Returns the eigenvalues of the matrix (as column vector)',
        arguments: [{ name: 'matrix' }],
        fn: (mat: number[][]): UnionValue => {

          if (mat.some((arr) => {
            return arr.some((v) => typeof v !== 'number');
          })) return ValueError();

          const m = Matrix.FromArray(mat);
          const e = m.EigenSystem();

          return {
            type: ValueType.array,
            value: [e.realvalues.map(value => {
              return {
                type: ValueType.number,
                value,
              };
            })],
          };

          /*
          return [e.realvalues.map(value => {
            return {
              type: ValueType.number,
              value,
            };
          })];
          */
        },
        extension: true,
      },

      EigenVectors: {
        description: 'Returns the eigenvectors of the matrix (as matrix)',
        arguments: [{ name: 'matrix' }],
        fn: (mat: number[][]): UnionValue => {

          if (mat.some((arr) => {
            return arr.some((v) => typeof v !== 'number');
          })) return ValueError();

          const m = Matrix.FromArray(mat);
          const e = m.EigenSystem();

          return {
            type: ValueType.array,
            value: e.vectors.map(vector => {
              return Array.from(vector).map(value => {
                return {
                  type: ValueType.number,
                  value,
                }
              });
            }),
          };

          /*
          return e.vectors.map(vector => {
            return Array.from(vector).map(value => {
              return {
                type: ValueType.number,
                value,
              }
            });
          });
          */
        },
        extension: true,
      },

      /*
      MMult: {
        description: 'Multiplies two matrices',
        arguments: [{ name: 'Matrix 1'}, { name: 'Matrix 2'}],
        fn: (a: number[][], b: number[][]) => {
          if (!a || !b) return ArgumentError();

          const a_cols = a.length || 0;
          const a_rows = a[0]?.length || 0;
  
          const b_cols = b.length || 0;
          const b_rows = b[0]?.length || 0;
  
          if (!a_rows || !b_rows || !a_cols || !b_cols
             || a_rows !== b_cols || a_cols !== b_rows) return ValueError();
  
          // this is backwards. why? because the arrays passed in 
          // are column-major. instead of calling transpose three times
          // we can just switch around. intransitive property ftw!

          const ma = Matrix.FromArray(a);
          const mb = Matrix.FromArray(b);

          const m = mb.Multiply(ma).ToArray();
          return m.map(row => row.map(value => {
            return {
              type: ValueType.number,
              value,
            };
          }));

        }  
      },
      */

      /*
      MInverse: {
        description: 'Returns the inverse matrix',
        arguments: [{ name: 'Matrix' }],
        fn: (a: number[][]) => {

          try {
            const mat = Matrix.FromArray(a).Transpose();
            const m = mat.Inverse().ToArray(true);
            return m.map(row => row.map(value => {
              return {
                type: ValueType.number,
                value,
              };
            }));

          }
          catch (err) {
            console.warn(err);
            return ValueError();
          }

        }
      },
      */

      // new stuff

      'RiskAMP.Task': {
        description: 'Models a task with dependencies for project planning',
        arguments: [],
        fn: (sample = 0, ...rest: CellValue[]): UnionValue => {

          let max = 0;
          for (let i = 0; i < rest.length; i++) {
            const value = rest[i];
            if (typeof value === 'number' && value > max) {
              max = value;
            }
          }
          
          return { type: ValueType.number, value: sample + max };

        },
        extension: true,
      },

      'RiskAMP.Scale': {
        description: 'Creates a uniform scale within a given range',
        arguments: [{ name: 'min' }, {name: 'max'}],
        fn: this.Scale.bind(this),
        extension: true,
      },

      'RiskAMP.HistogramTable': {
        description: 'Creates a histogram table from a source cell',
        arguments: [{ name: 'reference cell', collector: true, }],
        fn: this.HistogramTable.bind(this),
        extension: true,
      },

      'RiskAMP.Permutation': {
        description: 'Creates a random permutation of source data',
        arguments: [{ name: 'range', boxed: true }],
        fn: this.Permutation.bind(this),
        extension: true,
        simulation_volatile: true,
      },

      /*
      'RiskAMP.MatchingRange': {
        description: 'Stochastic regression function',
        arguments: [
          { name: 'Order reference', description: 'Order reference', collector: true },
          { name: 'Order min', description: 'Order min' }, 
          { name: 'Order max', description: 'Order max' }, 
          { name: 'Value reference', description: 'Value reference', collector: true },
        ],
        extension: true,
        fn: this.MatchingRange.bind(this),
      },
      */

      'RiskAMP.CountInRange': {
        description: 'Stochastic regression function',
        arguments: [
          { name: 'Order reference', description: 'Order reference', collector: true },
          { name: 'Order min', description: 'Order min' }, 
          { name: 'Order max', description: 'Order max' }, 
        ],
        extension: true,
        fn: this.CountInRange.bind(this),
      },

      'RiskAMP.IntervalInRange': {
        description: 'Stochastic regression function',
        arguments: [
          { name: 'Order reference', description: 'Order reference', collector: true },
          { name: 'Order min', description: 'Order min' }, 
          { name: 'Order max', description: 'Order max' }, 
          { name: 'Value reference', description: 'Value reference', collector: true },
          { name: 'Value min', description: 'Value min' }, 
        ],
        extension: true,
        fn: this.IntervalInRange.bind(this),
      },

      'RiskAMP.Polynomial.Fit': {
        description: 'Fit polynomial',
        arguments: [
          { name: 'x', description: 'x', },
          { name: 'y', description: 'y', },
          { name: 'degree', description: 'degree', },
        ],
        extension: true,
        fn: this.PolynomialFit.bind(this),
      },

      'RiskAMP.Polynomial.Apply': {
        description: 'Apply polynomial',
        arguments: [

        ],
        extension: true,
        fn: this.PolynomialApply.bind(this),
      },

      'RiskAMP.Polynomial.RealRoots': {
        description: 'Find real roots of a polynomial',
        arguments: [],
        extension: true,
        fn: this.PolynomialRealRoots.bind(this),
      },

      'RiskAMP.Polynomial.Roots': {
        description: 'Find roots of a polynomial',
        arguments: [],
        extension: true,
        fn: this.PolynomialRoots.bind(this),
      },

    };

  }

  /**
   * returns the shape of the caller, in case it's an array.
   * we can use this to allocate the response array to match.
   */
  public CallerArea(): { rows: number, columns: number } {
  
    let rows = 1, columns = 1;
    let cell: Cell|undefined;
  
    if (this.address.sheet_id) {
      for (const sheet of this.model?.sheets || []) {
        if (sheet.id === this.address.sheet_id) {
          if (sheet.cells.data[this.address.row]) {
            cell = sheet.cells.data[this.address.row][this.address.column];
          }
          break;
        }
      }
    }

    if (cell?.area) {
      rows = cell.area.rows;
      columns = cell.area.columns;
    }

    return { rows, columns };

  }

  public CorrelateDistributions(): void {

    for (const key of Object.keys(this.correlated_distributions)) {

      const desc = this.correlated_distributions[key];

      // addresses can get in here in an unsorted order. that was unexpected,
      // but we can resolve it by sorting before correlating. this matters
      // because the order of distributions needs to match the order of the
      // correlation matrix.

      // NOTE that there may still be problems if there are holes in the
      // dataset. however that's technically unsupported and therefore undefined,
      // so not sure how we should resolve it.

      desc.addresses.sort((a, b) => (a.column === b.column) ? a.row - b.row : a.column - b.column);

      const distributions = desc.addresses.map((address) => {
        return this.distributions[address.sheet_id || 0][address.column][address.row][address.call_index];
      });
      try {
        const result = MC.CorrelateCDM(desc.correlation, distributions, true);
        desc.addresses.forEach((address, index) => {
          this.distributions[address.sheet_id || 0][address.column][address.row][address.call_index] = result[index];
        });
      }
      catch (err) {
        // FIXME: put some zeros in there or something? (...)
        console.warn(err);
      }
    }
  }

  /**
   * creates space in the distributions array for this cell. each cell
   * might have multiple distributions, so the value is an array.
   */
  public InitDistribution(): void {

    if (!this.address) throw (new Error('invalid address'));
    if (!this.address.sheet_id) throw (new Error('address missing sheet ID'));

    if (!this.distributions[this.address.sheet_id]) {
      this.distributions[this.address.sheet_id] = [];
    }
    const sheet = this.distributions[this.address.sheet_id];

    if (!sheet[this.address.column]) {
      sheet[this.address.column] = [];
    }
    const column = sheet[this.address.column];

    if (!column[this.address.row]) {
      column[this.address.row] = [];
    }

    // let cell = column[this.address.row];
    // if (!cell) cell = []; // ?? this is local... not sure what it's expected to do
  }

  public StoreCellResults(address?: ICellAddress): Float64Array|number[]|undefined {

    // this is equivalent to "add shared rs"
    if (!address) address = this.address;

    if (!address) {
      return undefined;
    }

    if (!address.sheet_id) { throw new Error('SCR called without sheet id'); }

    if (!this.results[address.sheet_id]) this.results[address.sheet_id] = [];
    if (!this.results[address.sheet_id][address.column]) this.results[address.sheet_id][address.column] = [];
    const column = this.results[address.sheet_id][address.column];

    if (!column[address.row]) {
      column[address.row] = [];
    }

    const cell = column[address.row];

    return cell;

  }

  // --- multivariate distributions --------------------------------------------

  public PrepMultivariate(range_of_values: string, correlation_matrix: number[][]): void {

    if (!this.correlated_distributions[range_of_values]) {

      // support lower-triangular
      let correlation = CDMatrix.FromArray(correlation_matrix);

      if (!correlation.IsSymmetric()) {
        for (let m = 1; m < correlation_matrix.length; m++) {
          for (let n = 0; n < m; n++) {
            if (correlation_matrix[m][n]) {
              console.warn('invalid lower-triangular matrix');
              break;
            }
          }
        }
        correlation = correlation.Symmetrize(true);
      }

      this.correlated_distributions[range_of_values] = {
        correlation,
        addresses: [],
      };
    }
    this.correlated_distributions[range_of_values].addresses.push(
      {
        column: this.address.column,
        row: this.address.row,
        sheet_id: this.address.sheet_id,
        call_index: this.call_index,
      });

    this.InitDistribution();
  }

  public ValidateCorrelationMatrix(correlation_matrix: number[][]): boolean {

    let correlation = Matrix.FromArray(correlation_matrix);
    if (!correlation.IsSymmetric()) {
      correlation = correlation.Symmetrize(true);
    }

    if (correlation_matrix.some(row => row.some(value => typeof value !== 'number' && typeof value !== 'undefined'))
      || !correlation.IsPosDef()) {
      return false;
    }

    return true;
  }

  public multivariate_normal(range_of_values: string, correlation_matrix: number[][], mean = 0, sd = 1, min?: number, max?: number): UnionValue {

    // this test (and all the other ones) is in the wrong order

    if (this.state === SimulationState.Prep) {
      this.PrepMultivariate(range_of_values, correlation_matrix);

      if (typeof min !== 'undefined' || typeof max !== 'undefined') {
        this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
          MC.TruncatedNormal(this.iterations, { mean, sd, lhs: this.lhs, ordered: true, min, max });
      }
      else {
        this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
          MC.Normal(this.iterations, { mean, sd, lhs: this.lhs, ordered: true });
      }
    }
    else if (this.state === SimulationState.Simulation) {
      return { type: ValueType.number, value: this.distributions[this.address.sheet_id || 0]
        [this.address.column][this.address.row][this.call_index][this.iteration] };
    }
    if (!this.ValidateCorrelationMatrix(correlation_matrix)) { return DataError(); }

    // this is expensive. we should just use normal and truncate, since these are 
    // garbage values and never used in simulation. still, it looks better.

    if (typeof min !== 'undefined' || typeof max !== 'undefined') {
      return { type: ValueType.number, value: MC.TruncatedNormal(1, { mean, sd, min, max })[0] };
    }

    return { type: ValueType.number, value: MC.Normal(1, { mean, sd })[0] };
  }

  public multivariate_lognormal(range_of_values: string, correlation_matrix: number[][], mean = 0, sd = 1): UnionValue  {

    if (this.state === SimulationState.Prep) {
      this.PrepMultivariate(range_of_values, correlation_matrix);
      this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
        MC.LogNormal(this.iterations, { mean, sd, lhs: this.lhs, ordered: true });
    }
    else if (this.state === SimulationState.Simulation) {
      return { type: ValueType.number, value: this.distributions[this.address.sheet_id || 0]
        [this.address.column][this.address.row][this.call_index][this.iteration] };
    }
    if (!this.ValidateCorrelationMatrix(correlation_matrix)) { return DataError(); }

    return { type: ValueType.number, value: MC.LogNormal(1, { mean, sd })[0] };
  }

  public multivariate_beta(range_of_values: string, correlation_matrix: number[][], a = 1, b = 2): UnionValue  {
    if (this.state === SimulationState.Prep) {
      this.PrepMultivariate(range_of_values, correlation_matrix);
      this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
        MC.Beta(this.iterations, { a, b, lhs: this.lhs, ordered: true });
    }
    else if (this.state === SimulationState.Simulation) {
      return { type: ValueType.number, value: this.distributions[this.address.sheet_id || 0]
        [this.address.column][this.address.row][this.call_index][this.iteration] };
    }
    if (!this.ValidateCorrelationMatrix(correlation_matrix)) { return DataError(); }
    return { type: ValueType.number, value: MC.Beta(1, { a, b })[0] };
  }

  public multivariate_uniform(range_of_values: string, correlation_matrix: number[][], min = 0, max = 1, discrete = false): UnionValue  {

    // ref uniformvalue

    if (this.state === SimulationState.Prep) {
      this.PrepMultivariate(range_of_values, correlation_matrix);

      if (discrete) {
        min = Math.floor(min);
        max = Math.floor(max + 1);
        this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
          Discrete(MC.Uniform(this.iterations, { min, max, lhs: this.lhs, ordered: true }));
      }
      else {
        this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
          MC.Uniform(this.iterations, { min, max, lhs: this.lhs, ordered: true });
      }
    }
    else if (this.state === SimulationState.Simulation) {
      return { type: ValueType.number, value: this.distributions[this.address.sheet_id || 0]
        [this.address.column][this.address.row][this.call_index][this.iteration] };
    }
    if (!this.ValidateCorrelationMatrix(correlation_matrix)) { return DataError(); }

    if (discrete) {
      return { type: ValueType.number, value: Math.floor(MC.Uniform(1, { 
          min: Math.floor(min), 
          max: Math.floor(max + 1),
        })[0]) };
    }
    else {
      return { type: ValueType.number, value: MC.Uniform(1, { min, max })[0] };
    }

  }

  public multivariate_pert(range_of_values: string,
    correlation_matrix: number[][], min = 0, mode = 0.5, max = 1, lambda = 4, discrete = false): UnionValue  {

    // ref pertvalue

    if (this.state === SimulationState.Prep) {
      this.PrepMultivariate(range_of_values, correlation_matrix);

      if (discrete) {
        [min, mode, max] = Discrete3Parameters(min, mode, max);
        this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
          Discrete(MC.PERT(this.iterations, { a: min, b: max, c: mode, lambda, lhs: this.lhs, ordered: true }));
      }
      else {
        this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
          MC.PERT(this.iterations, { a: min, b: max, c: mode, lambda, lhs: this.lhs, ordered: true });
      }
    }
    else if (this.state === SimulationState.Simulation) {
      return { type: ValueType.number, value: this.distributions[this.address.sheet_id || 0]
        [this.address.column][this.address.row][this.call_index][this.iteration] };
    }
    if (!this.ValidateCorrelationMatrix(correlation_matrix)) { return DataError(); }

    if (discrete) {
      [min, mode, max] = Discrete3Parameters(min, mode, max);
    }

    return { type: ValueType.number, value: 
      discrete ? Math.floor(MC.PERT(1, { a: min, b: max, c: mode, lambda })[0]) : 
                 MC.PERT(1, { a: min, b: max, c: mode, lambda })[0]
    };

  }

  public multivariate_triangular(range_of_values: string,
    correlation_matrix: number[][], min = 0, mode = 0.5, max = 1, discrete = false): UnionValue  {

    // ref triangularvalue

    if (this.state === SimulationState.Prep) {
      this.PrepMultivariate(range_of_values, correlation_matrix);

      if (discrete) {
        [min, mode, max] = Discrete3Parameters(min, mode, max);
        this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
          Discrete(MC.Triangular(this.iterations, { a: min, b: max, c: mode, lhs: this.lhs, ordered: true }));
      }
      else {
        this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
          MC.Triangular(this.iterations, { a: min, b: max, c: mode, lhs: this.lhs, ordered: true });
      }
    }
    else if (this.state === SimulationState.Simulation) {
      return { type: ValueType.number, value: this.distributions[this.address.sheet_id || 0]
        [this.address.column][this.address.row][this.call_index][this.iteration] };
    }
    if (!this.ValidateCorrelationMatrix(correlation_matrix)) { return DataError(); }

    if (discrete) {
      [min, mode, max] = Discrete3Parameters(min, mode, max);
    }
    return { type: ValueType.number, value: 
      discrete ? Math.floor(MC.Triangular(1, { a: min, b: max, c: mode })[0]) :
                 MC.Triangular(1, { a: min, b: max, c: mode })[0] };

  }

  // --- discrete distributions ------------------------------------------------

  public poissonvalue(m: number): UnionValue {
    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
      this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
        MC.Poisson(this.iterations, { m, lhs: this.lhs });
    }
    else if (this.state === SimulationState.Simulation) {
      return {
        type: ValueType.number,
        value: this.distributions[this.address.sheet_id || 0]
          [this.address.column][this.address.row][this.call_index][this.iteration]
      };
    }
    return {
      type: ValueType.number,
      value: MC.Poisson(1, { m })[0],
    };
  }

  public binomialvalue(n: number, p: number): UnionValue {
    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
      this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
        MC.Binomial(this.iterations, { n, p, lhs: this.lhs });
    }
    else if (this.state === SimulationState.Simulation) {
      return {
        type: ValueType.number,
        value: this.distributions[this.address.sheet_id || 0]
          [this.address.column][this.address.row][this.call_index][this.iteration]
      };
    }
    return {
      type: ValueType.number,
      value: MC.Binomial(1, { n, p })[0],
    };
  }

  public negativebinomialvalue(n: number, p: number): UnionValue {
    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
      this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
        MC.NegativeBinomial(this.iterations, { n, p, lhs: this.lhs });
    }
    else if (this.state === SimulationState.Simulation) {
      return {
        type: ValueType.number,
        value: this.distributions[this.address.sheet_id || 0]
          [this.address.column][this.address.row][this.call_index][this.iteration]
      };
    }
    return {
      type: ValueType.number,
      value: MC.NegativeBinomial(1, { n, p })[0],
    };
  }

  // --- univariate distributions ----------------------------------------------

  public uniformvalue(discrete = false, min = 0, max = 1): UnionValue {
    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
      if (discrete) {
        min = Math.floor(min);
        max = Math.floor(max) + 1;
        this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
          Discrete(MC.Uniform(this.iterations, { min, max, lhs: this.lhs }));
      }
      else {
        this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
          MC.Uniform(this.iterations, { min, max, lhs: this.lhs });
      }
    }
    else if (this.state === SimulationState.Simulation) {
      return {
        type: ValueType.number,
        value: this.distributions[this.address.sheet_id || 0]
          [this.address.column][this.address.row][this.call_index][this.iteration]
      };
    }
    return {
      type: ValueType.number,
      value: discrete ? Math.floor(MC.Uniform(1, { min, max: max + 1})[0]) : MC.Uniform(1, { min, max })[0]
    };
  }

  public bernoullivalue(p = .5): UnionValue {
    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
      this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
        MC.Bernoulli(this.iterations, { p, lhs: this.lhs });
    }
    else if (this.state === SimulationState.Simulation) {
      return {
        type: ValueType.number,
        value: this.distributions[this.address.sheet_id || 0]
          [this.address.column][this.address.row][this.call_index][this.iteration]
      };
    }
    return {
      type: ValueType.boolean,
      value: MC.Bernoulli(1, { p })[0]
    };
  }

  // alias
  public probabilityvalue(p = .5): UnionValue { return this.bernoullivalue(p); }

  // new
  public sequentialvalue(data: any[][], count = 0): UnionValue {
    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
    }
    else if (this.state === SimulationState.Simulation) {
      let index = this.iteration;
      if (count > 0) index = (this.iteration % count);
      const rows = data[0].length;
      const column = Math.floor(index / rows) % data.length;
      const row = index % rows;
      return {
        type: ValueType.number,
        value: data[column][row]
      };
    }
    return {
      type: ValueType.number,
      value: data[0][0]
    };
  }

  // new
  public indexvalue(max = 0): UnionValue {
    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
    }
    else if (this.state === SimulationState.Simulation) {
      if (max > 0) {
        return {
          type: ValueType.number,
          value: (this.iteration % max) + 1
        };
      }
      return {
        type: ValueType.number,
        value: this.iteration + 1
      };
    }
    return {
      type: ValueType.number,
      value: 1
    };
  }

  public scaledlognormalvalue(mu = 0, sigma = 1): UnionValue {
    const m = Math.log( (mu*mu) / Math.sqrt( (mu*mu) + (sigma*sigma) ) );
    const s = Math.sqrt( Math.log( ((mu*mu) + (sigma*sigma)) / ( mu*mu) ) );
    return this.lognormalvalue(m, s);
  }

  public lognormalvalue(mean = 0, sd = 1): UnionValue {
    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
      this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
        MC.LogNormal(this.iterations, { mean, sd, lhs: this.lhs });
    }
    else if (this.state === SimulationState.Simulation) {
      return {
        type: ValueType.number, 
        value: this.distributions[this.address.sheet_id || 0]
          [this.address.column][this.address.row][this.call_index][this.iteration]
      };
    }
    return {
      type: ValueType.number, 
      value: MC.LogNormal(1, { mean, sd })[0]
    };
  }

  public truncatednormalvalue(mean = 0, sd = 1, min?: number, max?: number): UnionValue {
    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
      this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
        MC.TruncatedNormal(this.iterations, { mean, sd, lhs: this.lhs, min, max });
    }
    else if (this.state === SimulationState.Simulation) {
      return {
        type: ValueType.number, 
        value: this.distributions[this.address.sheet_id || 0]
          [this.address.column][this.address.row][this.call_index][this.iteration]
      };
    }
    return {type: ValueType.number, value: MC.TruncatedNormal(1, { mean, sd, min, max })[0] };
  }

  public normalvalue(mean = 0, sd = 1): UnionValue {
    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
      this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
        MC.Normal(this.iterations, { mean, sd, lhs: this.lhs });
    }
    else if (this.state === SimulationState.Simulation) {
      return {
        type: ValueType.number, 
        value: this.distributions[this.address.sheet_id || 0]
          [this.address.column][this.address.row][this.call_index][this.iteration]
      };
    }
    return {type: ValueType.number, value: MC.Normal(1, { mean, sd })[0] };
  }

  public pertvalue(discrete = false, min = 0, mode = .5, max = 1, lambda = 4): UnionValue {

    if (this.state === SimulationState.Prep) {
      this.InitDistribution();

      if (discrete) {
        [min, mode, max] = Discrete3Parameters(min, mode, max);
        this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
          Discrete(MC.PERT(this.iterations, { a: min, b: max, c: mode, lambda, lhs: this.lhs }));
      }
      else {
        this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
          MC.PERT(this.iterations, { a: min, b: max, c: mode, lambda, lhs: this.lhs });
      }
    }
    else if (this.state === SimulationState.Simulation) {
      return {
        type: ValueType.number, 
        value: this.distributions[this.address.sheet_id || 0]
        [this.address.column][this.address.row][this.call_index][this.iteration]
      };
    }

    if (discrete) {
      [min, mode, max] = Discrete3Parameters(min, mode, max);
    }

    return {
      type: ValueType.number, 
      value: discrete ? Math.floor(MC.PERT(1, { a: min, b: max, c: mode, lambda })[0]) :
        MC.PERT(1, { a: min, b: max, c: mode, lambda })[0],
    };
  }

  public pertvalue_p(p10 = 0, mode = .5, p90 = 1, lambda = 4): UnionValue {
    if (this.state === SimulationState.Prep) {
      const parms = MC.P80Pert(p10, p90, mode, lambda);
      this.InitDistribution();
      this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
        MC.PERT(this.iterations, { ...parms, lambda, lhs: this.lhs });
    }
    else if (this.state === SimulationState.Simulation) {
      return {
        type: ValueType.number, 
        value: this.distributions[this.address.sheet_id || 0]
          [this.address.column][this.address.row][this.call_index][this.iteration]
      };
    }

    const parms = MC.P80Pert(p10, p90, mode, lambda);
    return {
      type: ValueType.number, 
      value: MC.PERT(1, { ...parms, lambda })[0]
    };
  }

  /* *
   * unified function for distributions. it works, but all this indirection
   * seems like wasted cycles. since this is interpreted, it's probably better
   * to err on the side of extra code plus efficiency (not that any of this is
   * all that efficient to begin with; no need to make it any worse).
   * 
   * see triangularvalue for an example of the call
   * 
   * /
  public CommonDistributionFunction(fun: (...args: any[]) => any, instance: any, args: any) {
    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
      this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
        fun.apply(instance, [this.iterations].concat(args));
    }
    else if (this.state === SimulationState.Simulation) {
      return this.distributions[this.address.sheet_id || 0]
        [this.address.column][this.address.row][this.call_index][this.iteration];
    }
    return fun.apply(instance, [1].concat(args))[0];
  }
  */

  public triangularvalue(discrete = false, min = 0, mode = .5, max = 1): UnionValue {

    // DON'T REMOVE THIS, it's an example of how we were using the
    // unified distribution function -- we want to keep this for a 
    // little while to consider.

    // (note that was before the discrete option was added)

    // return this.CommonDistributionFunction(MC.Triangular, MC, [{a: min, b: max, c: mode, lhs: this.lhs}]);

    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
      if (discrete) {
        [min, mode, max] = Discrete3Parameters(min, mode, max);
        this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
          Discrete(MC.Triangular(this.iterations, { a: min, b: max, c: mode, lhs: this.lhs }));
      }
      else {
        this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
          MC.Triangular(this.iterations, { a: min, b: max, c: mode, lhs: this.lhs });
      }
    }
    else if (this.state === SimulationState.Simulation) {
      return {
        type: ValueType.number,
        value: this.distributions[this.address.sheet_id || 0]
          [this.address.column][this.address.row][this.call_index][this.iteration]
      };
    }

    if (discrete) {
      [min, mode, max] = Discrete3Parameters(min, mode, max);
    }

    return {
      type: ValueType.number,
      value: discrete ? Math.floor(MC.Triangular(1, { a: min, b: max, c: mode })[0]) :
        MC.Triangular(1, { a: min, b: max, c: mode })[0]
    };
  }

  public betavalue(a = 1, b = 1): UnionValue {
    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
      this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
        MC.Beta(this.iterations, { a, b, lhs: this.lhs });
    }
    else if (this.state === SimulationState.Simulation) {
      return {
        type: ValueType.number,
        value: this.distributions[this.address.sheet_id || 0]
          [this.address.column][this.address.row][this.call_index][this.iteration]
      };
    }
    return {
      type: ValueType.number,
      value: MC.Beta(1, { a, b })[0]
    };
  }

  public samplevalue(range: any[]): UnionValue {
    return this.uniformrangesample(range);
  }

  public samplevalue_weighted(range: any[], weights: any[]): UnionValue {

    // create a uniform distribution in {0,1}

    // we're not caching. why not? because we want to support variable
    // weights and values. not sure that that is a good idea, though.
    // without caching this function is slow.

    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
      this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
        MC.Uniform(this.iterations, { min: 0, max: 1, lhs: this.lhs });
    }
    else {
      const r = (this.state === SimulationState.Simulation) ?
        this.distributions[this.address.sheet_id || 0]
          [this.address.column][this.address.row][this.call_index][this.iteration] :
        MC.Uniform(1, { min: 0, max: 1 })[0];

      // assume it's rectangular. if not, there's nothing we can do.

      if (!range || !range.length) {
        return {
          type: ValueType.undefined,
          value: undefined,
        };
      }

      // FIXME: cache! [see above]

      const sum = // SpreadsheetFunctions.sum(weights);
        Utils.FlattenUnboxed(weights).reduce((a: number, b: any) => {
          if (typeof b === 'undefined') return a;
          return a + Number(b);
        }, 0);

      const value = r * sum;
      let step = 0;

      for (let col = 0; col < range.length; col++) {
        for (let row = 0; row < range[col].length; row++) {
          step += weights[col][row];
          if (step >= value) {
            return {
              type: ValueType.number,
              value: range[col][row]
            };
          }
        }
      }

    }

    return {
      type: ValueType.number,
      value: range[0][0],
    };

  }

  public uniformrangesample(range: any[]): UnionValue {

    // create a uniform distribution in {0,1}

    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
      this.distributions[this.address.sheet_id || 0][this.address.column][this.address.row][this.call_index] =
        MC.Uniform(this.iterations, { min: 0, max: 1, lhs: this.lhs });
    }

    const r = (this.state === SimulationState.Simulation) ?
      this.distributions[this.address.sheet_id || 0]
        [this.address.column][this.address.row][this.call_index][this.iteration] :
        MC.Uniform(1, { min: 0, max: 1 })[0];

    // assume it's rectangular. if not, there's nothing we can do.

    if (!range || !range.length) return {
      type: ValueType.undefined,
      value: undefined
    };

    // const count = range[0].length * range.length;
    // const index = Math.floor(count * r);

    const index = Math.floor(range[0].length * range.length * r);

    // const column = index % range.length;
    // const row = Math.floor(index / range.length);
    // const val = range[column][row];

    const value = range[index % range.length][Math.floor(index / range.length)] || ''

    // FIXME: what should undefined look like?
    return {
      value,
      type: GetValueType(value),
    };

  }

  // --- simulation functions --------------------------------------------------

  public simulationtrials(): UnionValue {
    return { type:ValueType.number, value: this.trials };
  }

  public simulationtime(): UnionValue {
    return { type:ValueType.number, value: this.elapsed / 1000 };
  }

  public PolynomialRoots(coefficients: number[], offset_intercept = 0) {

    coefficients = Utils.FlattenUnboxed(coefficients);
    if (offset_intercept) {
      coefficients[0] += offset_intercept;
    }

    const roots = Polynomial.Roots(coefficients);

    if (roots.length) {
      const values: UnionValue[] = [];
      for (const root of roots) {
        values.push({
          type: ValueType.complex,
          value: root,
        });
      }
      return {
        type: ValueType.array,
        value: [values],
      };
    }

    return { type: ValueType.undefined };

  }

  public PolynomialRealRoots(coefficients: number[], offset_intercept = 0, min?: number, max?: number) {

    // return { type: ValueType.undefined };

    coefficients = Utils.FlattenUnboxed(coefficients);
    if (offset_intercept) {
      coefficients[0] += offset_intercept;
    }

    const roots = Polynomial.Roots(coefficients);
    let real_roots: number[] = roots.filter(complex => Math.abs(complex.imaginary) < 1e-12).map(x => x.real);

    if (typeof min === 'number') {
      real_roots = real_roots.filter(x => x >= min);
    }
    if (typeof max === 'number') {
      real_roots = real_roots.filter(x => x <= max);
    }

    const value = real_roots.map(value => [{
      type: ValueType.number,
      value,
    }]);

    if (value.length > 0) {
      return {
        type: ValueType.array,
        value: real_roots.map(value => [{
            type: ValueType.number,
            value,
          }]),
      };
    }

    return { type: ValueType.undefined };

  }

  public PolynomialApply(coefficients: number[][], x: number) {

    // return { type: ValueType.undefined };

    const value = Polynomial.Apply(Utils.FlattenUnboxed(coefficients), x);
    return {
      type: ValueType.number, 
      value,
    };

  }

  public PolynomialFit(x: number[][], y: number[][], degree: number) {

    const result = Polynomial.Fit(Utils.FlattenUnboxed(x), Utils.FlattenUnboxed(y), degree);
    // console.info({result, x, y});

    const value = result.map(value => [{
      type: ValueType.number,
      value,
    }]);

    if (value.length) {
      return {
        type: ValueType.array,
        value,
      };
    }

    return { type: ValueType.undefined };

  }

  /* testing */
  public MatchingRange(order: number[], min: number, max: number, values: number[]) {

    if (this.state !== SimulationState.Null) {
      return { type: ValueType.number, value: 0 };
    }
    if (!order || !order.length) {
      return DataError();
    }
    if (!values || !values.length) {
      return DataError();
    }

    // can't happen. we should validate anyway.
    if (values.length !== order.length) {
      return DataError();
    }

    const data: UnionValue[] = [];

    const len = values.length;

    for (let i = 0; i < len; i++) {
      if (order[i] >= min && order[i] <= max) {
        data.push({
          type: ValueType.number,
          value: values[i],
        });
      }
    }

    return {
      type: ValueType.array,
      value: [data],
    };

  }

  public CountInRange(order: number[], min: number, max: number) {

    if (this.state !== SimulationState.Null) {
      return { type: ValueType.number, value: 0 };
    }
    if (!order || !order.length) {
      return DataError();
    }

    let count = 0;

    const len = order.length;

    for (let i = 0; i < len; i++) {
      if (order[i] >= min && order[i] <= max) {
          count++;
      }
    }

    return { 
      type:ValueType.number, 
      value: count,
    };

  }

  /**
   * this is a support function for stochastic regression. it's a composite
   * of various things you can do using regular functions, countif, and arrays,
   * but it should be much more efficient.
   * 
   * @param order -- the ordering cell. this is usually the value we are 
   * testing, and it should ordinarily be a uniform distribution (either discrete
   * or continuous). we want it to be uniform so we have a similar count in
   * each bucket.
   * 
   * @param min -- min value for the order cell
   * @param max -- max value for the order cell
   * 
   * @param values -- the values cell. if the ordering cell value falls within
   * the min/max range, we test the value cell. the count of "hits" here is
   * the denominator of our result.
   * 
   * @param floor -- floor value for the values cell. if the values cell value
   * in the given test is above the floor, we count that as 1. otherwise we 
   * count it as 0. the sum of these test values is the numerator of our result.
   * 
   * @returns how many times, expressed as a percentage, was the values cell
   * above the floor _when_ the order cell was within the target range.
   */
  public IntervalInRange(order: number[], min: number, max: number, values: number[], floor = 0) {

    if (this.state !== SimulationState.Null) {
      return { type: ValueType.number, value: 0 };
    }
    if (!order || !order.length) {
      return DataError();
    }
    if (!values || !values.length) {
      return DataError();
    }

    // can't happen. we should validate anyway.
    if (values.length !== order.length) {
      return DataError();
    }

    let count = 0;
    let rangecount = 0;

    const len = values.length;

    for (let i = 0; i < len; i++) {
      if (order[i] >= min && order[i] <= max) {
        rangecount++;
        if (values[i] >= floor ) {
          count++;
        }
      }
    }

    return { 
      type:ValueType.number, 
      value: rangecount > 0 ? count / rangecount : 0,
    };

  }

  public simulationvaluesarray(data?: number[]): UnionValue {
    
    if (this.state !== SimulationState.Null) {
      return { type: ValueType.number, value: 0 };
    }
    if (!data || !data.length) {
      return DataError();
    }

    const result: UnionValue[] = [];
    for (let i = 0; i < data.length; i++) {
      result[i] = {type: ValueType.number, value: data[i] };
    }

    return { type: ValueType.array, value: [result]};

  }

  /**
   * now defaults to ordering by source cell
   * UPDATE: now does that properly. if there's no sort argument, use the 
   * source cell. if there's a source cell but no data, return an error.
   */
  public simulationvaluesarray_ordered(data?: number[], order_by?: number[]): UnionValue {

    if (this.state !== SimulationState.Null) {
      return { type: ValueType.number, value: 0 };
    }

    if (!data || !data.length || (order_by && !order_by.length)) {
      return DataError();
    }
    
    if (!order_by) {

      // can use a simpler sort method in this case
      // be sure to copy so we don't munge the original data

      return {
        type: ValueType.array,
        value: [Array.prototype.slice.call(data, 0).sort((a, b) => a - b).map(value => {
          return {
            type: ValueType.number,
            value,
          };
        })],
      };

    }

    const tuples = Array.from(data).map((x, i) => [x, order_by[i]]);
    tuples.sort((a, b) => a[1] - b[1]);

    return {
      type: ValueType.array,
      value: [tuples.map((tuple) => {
        return {
          type: ValueType.number,
          value: tuple[0]
        }
      })],
    };

  }

  public simulationrsquared(dependent?: number[], independent?: number[]): UnionValue {
    if (this.state !== SimulationState.Null) {
      return { type: ValueType.number, value: 0 };
    }
    if (!dependent || !dependent.length || !independent || !independent.length) {
      return DataError();
    }

    const {r2, error} = Stats.R22(dependent, independent);

    if (error) {
      return ValueError();
    }

    return { type: ValueType.number, value: r2||0 };
  }

  public simulationcorrelation(a?: number[], b?: number[]): UnionValue {

    if (this.state !== SimulationState.Null) {
      return { type: ValueType.number, value: 0 };
    }
    if (!a || !a.length || !b || !b.length) {
      return DataError();
    }

    return { type: ValueType.number, value: Stats.Correlation(a, b) };
  }

  public simulationcorrelationmatrix(range: any, full_matrix = false): UnionValue {

    if (this.state !== SimulationState.Null) {
      return { type: ValueType.number, value: 0 };
    }

    // could be one cell... we don't really have a good
    // way of checking that. for a range, though, should be 2D

    if (!Array.isArray(range) || !Array.isArray(range[0])) {
      // console.info("maybe 1d?")
      return { type: ValueType.number, value: 1 };
    }

    // make sure that we only have one row or one column
    // we can assume, atm, that range is square. not a super
    // safe assumption though, it might change in the future...

    if (range.length > 1) {
      if (range[0].length > 1) {
        return ArgumentError();
      }
    }

    // OK we have a row or column, now we can apply. create a flat set
    // (FIXME: does this need to change orientation depending on input?)

    const flat: (number[]|Float64Array)[] = [];

    let missing = false;

    for (const row of range) {
      for (const entry of row) {
        flat.push(entry);
        if (!entry.length) {
          missing = true;
        }
      }
    }

    if (missing) {
      return DataError();
    }

    const len = flat.length;
    const result: UnionValue[][] = [];

    // this needs to be square as well, or the spread routine 
    // might short-cut when rendering it into the spreadsheet

    let i = 0;
    let j = 0;

    for (i = 0; i < len; i++) {
      const row: UnionValue[] = [];
      for (j = 0; j <= i; j++) {
        row.push({ 
          type: ValueType.number, 
          value: i === j ? 1 : Stats.Correlation(flat[i], flat[j]),
        });
      }
      for (; j < len; j++) {
        row.push({ type: ValueType.undefined });
      }
      result.push(row);
    }

    // console.info({result});

    return { type: ValueType.array, value: Utils.TransposeArray(result) };
    
    /*
    const result: UnionValue[][] = [];
    let index = 0;
    for (let c = 0; c < columns; c++) {
      const column: UnionValue[] = [];
      for (let r = 0; r < rows; r++) {
        column.push({ type: ValueType.number, value: shuffled[index++] });
      }
      result.push(column);
    }

    return { type: ValueType.array, value: result };
    */

    return { type: ValueType.number, value: 143, };
  }

  public sortedsimulationindex(data?: number[], index = 1): UnionValue {

    if (this.state !== SimulationState.Null) {
      return { type: ValueType.number, value: 0 };
    }
    if (!data || !data.length) {
      return DataError();
    }

    if (index < 1 || index > data.length) {
      return ArgumentError();
    }

    const pairs = Array.from(data).map((x, i) => [x, i + 1]);
    pairs.sort((a, b) => a[0] - b[0]);

    return { type: ValueType.number, value: pairs[index - 1][1] };

  }

  public simulationvalue_cumulative(data?: number[], index = 1): UnionValue {

    if (this.state !== SimulationState.Null) {
      return { type: ValueType.number, value: 0 };
    }
    if (!data || !data.length) {
      return DataError();
    }

    if (index < 1 || index > data.length) {
      return ArgumentError();
    }

    let cumulative = 0;
    for (let i = 0; i < index; i++) {
      cumulative += data[i];
    }

    return { type:ValueType.number, value: cumulative };
    
  }

  public simulationvalue(data?: number[], index = 1): UnionValue {

    if (this.state !== SimulationState.Null) {
      return { type: ValueType.number, value: 0 };
    }
    if (!data || !data.length) {
      return DataError();
    }

    if (index < 1 || index > data.length) {
      return ArgumentError();
    }

    return { type:ValueType.number, value: data[index - 1] };

  }

  public simulationpercentile(data?: number[], percentile = .5): UnionValue {

    if (this.state !== SimulationState.Null) {
      return { type: ValueType.number, value: 0 };
    }
    if (!data || !data.length) {
      return DataError();
    }

    return { type:ValueType.number, value: Stats.Percentile(data, percentile) };
  }

  public simulationstandarddeviation(data?: number[]): UnionValue {

    if (this.state !== SimulationState.Null) {
      return { type: ValueType.number, value: 0 };
    }
    if (!data || !data.length) {
      return DataError();
    }

    const stats = Stats.Statistics(data);
    return { type:ValueType.number, value: stats.stdev };
  }

  public simulationvariance(data?: number[]): UnionValue {

    if (this.state !== SimulationState.Null) {
      return { type: ValueType.number, value: 0 };
    }
    if (!data || !data.length) {
      return DataError();
    }

    const stats = Stats.Statistics(data);
    return { type:ValueType.number, value: stats.variance };
  }

  public simulationskewness(data?: number[]): UnionValue {

    if (this.state !== SimulationState.Null) {
      return { type: ValueType.number, value: 0 };
    }
    if (!data || !data.length) {
      return DataError();
    }

    const stats = Stats.Statistics(data);
    return { type:ValueType.number, value: stats.skewness };
  }

  public simulationkurtosis(data?: number[]): UnionValue {

    if (this.state !== SimulationState.Null) {
      return { type: ValueType.number, value: 0 };
    }
    if (!data || !data.length) {
      return DataError();
    }

    const stats = Stats.Statistics(data);
    return { type:ValueType.number, value: stats.kurtosis };
  }

  public simulationinterval(data?: number[], min?: number, max?: number): UnionValue {

    if (this.state !== SimulationState.Null) {
      return { type: ValueType.number, value: 0 };
    }
    if (!data || !data.length) {
      return DataError();
    }

    return { type:ValueType.number, value: Stats.Interval({ data, min, max }) };
  }

  public simulationstandarderror(data?: number[]): UnionValue {

    if (this.state !== SimulationState.Null) {
      return { type: ValueType.number, value: 0 };
    }
    if (!data || !data.length) {
      return DataError();
    }

    let sum = 0;
    let variance = 0;

    // start with mean
    for (const value of data) { sum += (value || 0); }
    const mean = sum / data.length;

    // next calc variance
    for (const value of data) {
      const deviation = value - mean;
      variance += (deviation * deviation);
    }

    return { 
      type:ValueType.number, 
      value: (Math.sqrt(variance / data.length)) / Math.sqrt(data.length),
    };

  }

  public simulationmin(data?: number[]): UnionValue {

    if (this.state !== SimulationState.Null) {
      return { type: ValueType.number, value: 0 };
    }
    if (!data || !data.length) {
      return DataError();
    }

    return { type:ValueType.number, value: Math.min.apply(0, data) };
  }

  public simulationmax(data?: number[]): UnionValue {

    if (this.state !== SimulationState.Null) {
      return { type: ValueType.number, value: 0 };
    }
    if (!data || !data.length) {
      return DataError();
    }

    return { type:ValueType.number, value: Math.max.apply(0, data) };
  }

  public simulationmode(data?: number[]): UnionValue {

    if (this.state !== SimulationState.Null) {
      return { type: ValueType.number, value: 0 };
    }
    if (!data || !data.length) {
      return DataError();
    }

    // this is different than what we do in Excel. here, we're going
    // to just treat the data as discrete via a floor function. what
    // that means in the case of continuous data is open to interpretation.
    
    const list: number[] = [];
    const pairs: Array<[number, number]> = [];

    for (const value of data) {
      const discrete = Math.floor(value);
      list[discrete] = (list[discrete] || 0) + 1;
    }

    list.forEach((value, i) => pairs.push([value, i]));
    pairs.sort((a, b) => b[0] - a[0]);

    return { type: ValueType.number, value: pairs[0][1] };

  }

  public simulationmean(data?: number[]): UnionValue {

    if (this.state !== SimulationState.Null) {
      return { type: ValueType.number, value: 0 };
    }
    if (!data || !data.length) {
      return DataError();
    }

    // return data.reduce((a: number, b: number) => a + b, 0) / data.length;
    let sum = 0;
    for (const value of data) sum += value;
    return { type: ValueType.number, value: sum / data.length };

  }

  public simulationmedian(data?: number[]): UnionValue {

    if (this.state !== SimulationState.Null) {
      return { type: ValueType.number, value: 0 };
    }
    if (!data || !data.length) {
      return DataError();
    }

    const copy = data.filter((element: number) => typeof element === 'number' ? element : 0); // when would this happen? 
    copy.sort((a: number, b: number) => a - b);

    return {type: ValueType.number, value: copy[Math.round(copy.length / 2)]};

  }

  public Permutation(range?: UnionValue): UnionValue {

    if (!range) {

      // special case, no argument

      const { rows, columns } = this.CallerArea();
      const count = rows * columns;

      if (count <= 0) { return ArgumentError(); }
      const shuffled = ShuffledIntegers(count);

      const result: UnionValue[][] = [];
      let index = 0;
      for (let c = 0; c < columns; c++) {
        const column: UnionValue[] = [];
        for (let r = 0; r < rows; r++) {
          column.push({ type: ValueType.number, value: shuffled[index++] });
        }
        result.push(column);
      }

      return { type: ValueType.array, value: result };
      
    }

    // if (Array.isArray(range)) {
    if (range.type === ValueType.array) {

      const rows = (range as ArrayUnion).value.length;
      const cols = (range as ArrayUnion).value[0].length;

      if (!rows || !cols) {
        return ArgumentError();
      }

      const flat = (range as ArrayUnion).value.reduce((a, arr) => arr.concat(a), []);
      const count = rows * cols;

      if (flat.length !== count) {
        console.info('invalid?', count, range, flat);
        throw new Error('invalid length');
      }

      const shuffled = ShuffledIntegers(count);

      const result: UnionValue[][] = [];
      let index = 0;

      // is this backwards? somehow it still seems to work...

      for (let r = 0; r < rows; r++) {
        const row: UnionValue[] = [];
        for (let c = 0; c < cols; c++) {
          const x = shuffled[index++];
          row.push({ ...flat[x] });
        }
        result.push(row);
      }

      return { type: ValueType.array, value: result };

    }
    else {
      return {...range}; // single value?
    }

  }

  public Scale(min: number, max: number, discrete = false): UnionValue {

    /*
    let rows = 1, columns = 1;

    let cell: Cell|undefined;

    if (this.address.sheet_id) {
      for (const sheet of this.model?.sheets || []) {
        if (sheet.id === this.address.sheet_id) {
          if (sheet.cells.data[this.address.row]) {
            cell = sheet.cells.data[this.address.row][this.address.column];
          }
          break;
        }
      }
    }

    if (!cell) { return ArgumentError(); }

    if (cell.area) {
      const area = new Area(cell.area.start, cell.area.end);
      rows = area.rows;
      columns = area.columns;
    }
    */

    const { rows, columns } = this.CallerArea();

    const length = Math.max(rows, columns);
    const scale = min > max ?
      CreateScale(max, min, length - 1, true, discrete) : 
      CreateScale(min, max, length - 1, true, discrete) ;

    // console.info('(scale)', 'discrete?', discrete, 's', scale);

    let base = scale.min;

    // const result: Array<number|undefined>[] = [[]];
    const result: UnionValue[][] = [[]];

    if (scale.count < length - 1) {
      base = scale.min - (Math.ceil((length - scale.count) / 2)) * scale.step;
    }

    if (min > max) {
      for (let i = 0; i < length; i++) {
        const bucket = base + i * scale.step;
        result[0][length - 1 - i] = { type: ValueType.number, value: bucket };
      }
    }
    else {
      for (let i = 0; i < length; i++) {
        const bucket = base + i * scale.step;
        result[0][i] = { type: ValueType.number, value: bucket };
      }
    }

    return {
      type: ValueType.array,
      value: rows < columns ? Utils.Transpose2(result) : result,
    };

    // return rows < columns ? Utils.Transpose2(result) : result;

  }

  public HistogramTable(reference: any): UnionValue {

    // this function used to rely on the Cell structure being passed
    // as the address. we used to do that, in error. while we might want
    // to bring it back, for the time being we will look up in the model
    // instead.

    const {rows, columns} = this.CallerArea();

    const length = Math.max(rows, columns);
    const depth = Math.min(rows, columns);

    if (Array.isArray(reference) || reference instanceof Float64Array || reference instanceof Float32Array) {

      if (reference.length <= 1) {
        return {
          type: ValueType.number,
          value: 0,
        }; // ??
      }

      if (!Array.isArray(reference)) {
        reference = Array.prototype.slice.call(reference);
      }

      reference.sort((a: number, b: number) => a - b);

      const min = reference[0] || 0; 
      const max = reference[reference.length - 1] || 0;

      let discrete = true;
      for (const value of reference) {
        if (value % 1 !== 0) {
          discrete = false;
          break;
        }
      }
      
      if (max === min) {
        // ...
        return {
          type: ValueType.number,
          value: 0,
        };
      }
     
      let result: UnionValue[][] = [[], []];

      const scale = CreateScale(min, max, length, true, discrete);

      // console.info('(table)', 'discrete?', discrete, 's', scale);

      let base = scale.min;
      let index = 0;

      // is it length or length - 1 ?

      // ANSWER: we're using slightly different algorithms for this function
      // vs the Scale function. here, we label each bucket with the end value,
      // and the start value for the initial bucket is implicit.

      // in the scale function, it's not necessarily clear which way you are 
      // going, so we make sure that the scale includes the low-end as well as 
      // the high end.

      if (scale.count < length) {
        base = scale.min - (Math.ceil((length - scale.count) / 2)) * scale.step;
      }

      for (let i = 0; i < length; i++) {

        // count from (last) to (next)
        const bucket = base + (i + 1) * scale.step;
        
        let count = 0;
        for (; index < reference.length && reference[index] <= bucket; index++, count++) { /* */ }

        result[1][i] = {
          type: ValueType.number,
          value: count,
        }; // (this.trials || 0);
        
        result[0][i] = {
          type: ValueType.number,
          value: bucket,
        };

      }

      if (depth === 1 ){
        result = [result[1]];
      }

      // return (columns > rows) ? Utils.Transpose2(result) : result;
      return {
        type: ValueType.array,
        value: (columns > rows) ? Utils.Transpose2(result) : result,
      }

    }

    return {
      type: ValueType.number,
      value: 0,
    };

  }

}
