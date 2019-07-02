
import { ICellAddress } from 'treb-base-types';
import * as Utils from './utilities';
import { Matrix, CDMatrix, MC, Stats } from 'riskampjs-mc';
import { FunctionLibrary, CompositeFunctionDescriptor } from './function-library';

export enum SimulationState {
  Null, Prep, Simulation, Post,
}

interface DistributionKey extends ICellAddress {
  call_index: number;
}

/**
 * class represents a model, including simulation data and functions. the
 * spreadsheet functions refer to an instance of the model, which retains
 * state.
 */
export class SimulationModel {

  public iteration = 0;
  public iterations = 0;
  public call_index = 0;
  public lhs = false;
  public state = SimulationState.Null;
  public address: ICellAddress = { row: 0, column: 0 };
  public volatile = false;
  public results: number[][][] = [];
  public elapsed = 0;
  public trials = 0;
  public distributions: any = [];
  public correlated_distributions: { [index: string]: { addresses: DistributionKey[], correlation: any } } = {};

  public CorrelateDistributions() {
    for (const key of Object.keys(this.correlated_distributions)) {
      const desc = this.correlated_distributions[key];
      const distributions = desc.addresses.map((address) => {
        return this.distributions[address.column][address.row][address.call_index];
      });
      const result = MC.CorrelateCDM(desc.correlation, distributions, true);
      desc.addresses.forEach((address, index) => {
        this.distributions[address.column][address.row][address.call_index] = result[index];
      });
    }
  }

  /**
   * creates space in the distributions array for this cell. each cell
   * might have multiple distributions, so the value is an array.
   */
  public InitDistribution() {

    if (!this.address) throw (new Error('invalid address'));

    if (!this.distributions[this.address.column]) this.distributions[this.address.column] = [];
    const column = this.distributions[this.address.column];

    if (!column[this.address.row]) column[this.address.row] = [];
    let cell = column[this.address.row];

    if (!cell) cell = [];
  }

  public CellData(address?: ICellAddress) {

    // this is equivalent to "add shared rs"
    if (!address) address = this.address;

    if (!address) return null;

    if (!this.results[address.column]) this.results[address.column] = [];
    const column = this.results[address.column];

    if (!column[address.row]) column[address.row] = [];
    const cell = column[address.row];

    return cell;

  }

  // --- multivariate distributions --------------------------------------------

  public PrepMultivariate(range_of_values: any, correlation_matrix: number[][]) {
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
      { column: this.address.column, row: this.address.row, call_index: this.call_index });

    this.InitDistribution();
  }

  public ValidateCorrelationMatrix(correlation_matrix: number[][]) {
    let correlation = Matrix.FromArray(correlation_matrix);
    if (!correlation.IsSymmetric()) {
      correlation = correlation.Symmetrize(true);
    }
    if (!correlation.IsPosDef()) {
      return false;
    }
    return true;
  }

  public multivariate_normal(range_of_values: any, correlation_matrix: number[][], mean = 0, sd = 1) {

    if (this.state === SimulationState.Prep) {
      this.PrepMultivariate(range_of_values, correlation_matrix);
      this.distributions[this.address.column][this.address.row][this.call_index] =
        MC.Normal(this.iterations, { mean, sd, lhs: this.lhs, ordered: true });
    }
    else if (this.state === SimulationState.Simulation) {
      return this.distributions[this.address.column][this.address.row][this.call_index][this.iteration];
    }
    if (!this.ValidateCorrelationMatrix(correlation_matrix)) { return '#ERR'; }

    return MC.Normal(1, { mean, sd })[0];
  }

  public multivariate_beta(range_of_values: any, correlation_matrix: number[][], a = 1, b = 2) {
    if (this.state === SimulationState.Prep) {
      this.PrepMultivariate(range_of_values, correlation_matrix);
      this.distributions[this.address.column][this.address.row][this.call_index] =
        MC.Beta(this.iterations, { a, b, lhs: this.lhs, ordered: true });
    }
    else if (this.state === SimulationState.Simulation) {
      return this.distributions[this.address.column][this.address.row][this.call_index][this.iteration];
    }
    if (!this.ValidateCorrelationMatrix(correlation_matrix)) { return '#ERR'; }
    return MC.Beta(1, { a, b })[0];
  }

  public multivariate_uniform(range_of_values: any, correlation_matrix: number[][], min = 0, max = 1) {
    if (this.state === SimulationState.Prep) {
      this.PrepMultivariate(range_of_values, correlation_matrix);
      this.distributions[this.address.column][this.address.row][this.call_index] =
        MC.Uniform(this.iterations, { min, max, lhs: this.lhs, ordered: true });
    }
    else if (this.state === SimulationState.Simulation) {
      return this.distributions[this.address.column][this.address.row][this.call_index][this.iteration];
    }
    if (!this.ValidateCorrelationMatrix(correlation_matrix)) { return '#ERR'; }
    return MC.Uniform(1, { min, max })[0];
  }

  public multivariate_pert(range_of_values: any,
    correlation_matrix: number[][], min = 0, mode = 0.5, max = 1, lambda = 4) {

    if (this.state === SimulationState.Prep) {
      this.PrepMultivariate(range_of_values, correlation_matrix);
      this.distributions[this.address.column][this.address.row][this.call_index] =
        MC.PERT(this.iterations, { a: min, b: max, c: mode, lambda, lhs: this.lhs, ordered: true });
    }
    else if (this.state === SimulationState.Simulation) {
      return this.distributions[this.address.column][this.address.row][this.call_index][this.iteration];
    }
    if (!this.ValidateCorrelationMatrix(correlation_matrix)) { return '#ERR'; }
    return MC.PERT(1, { a: min, b: max, c: mode, lambda })[0];
  }

  public multivariate_triangular(range_of_values: any,
    correlation_matrix: number[][], min = 0, mode = 0.5, max = 1) {

    if (this.state === SimulationState.Prep) {
      this.PrepMultivariate(range_of_values, correlation_matrix);
      this.distributions[this.address.column][this.address.row][this.call_index] =
        MC.Triangular(this.iterations, { a: min, b: max, c: mode, lhs: this.lhs, ordered: true });
    }
    else if (this.state === SimulationState.Simulation) {
      return this.distributions[this.address.column][this.address.row][this.call_index][this.iteration];
    }
    if (!this.ValidateCorrelationMatrix(correlation_matrix)) { return '#ERR'; }
    return MC.Triangular(1, { a: min, b: max, c: mode })[0];
  }

  // --- univariate distributions ----------------------------------------------

  public uniformvalue(min = 0, max = 1) {
    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
      this.distributions[this.address.column][this.address.row][this.call_index] =
        MC.Uniform(this.iterations, { min, max, lhs: this.lhs });
    }
    else if (this.state === SimulationState.Simulation) {
      return this.distributions[this.address.column][this.address.row][this.call_index][this.iteration];
    }
    return MC.Uniform(1, { min, max })[0];
  }

  public bernoullivalue(p = .5) {
    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
      this.distributions[this.address.column][this.address.row][this.call_index] =
        MC.Bernoulli(this.iterations, { p, lhs: this.lhs });
    }
    else if (this.state === SimulationState.Simulation) {
      return this.distributions[this.address.column][this.address.row][this.call_index][this.iteration];
    }
    return MC.Bernoulli(1, { p })[0];
  }

  // alias
  public probabilityvalue(p = .5) { return this.bernoullivalue(p); }

  // new
  public sequentialvalue(data: any[][], count = 0) {
    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
    }
    else if (this.state === SimulationState.Simulation) {
      let index = this.iteration;
      if (count > 0) index = (this.iteration % count);
      const rows = data[0].length;
      const column = Math.floor(index / rows) % data.length;
      const row = index % rows;
      return data[column][row];
    }
    return data[0][0];
  }

  // new
  public indexvalue(max = 0) {
    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
    }
    else if (this.state === SimulationState.Simulation) {
      if (max > 0) return (this.iteration % max) + 1;
      return this.iteration + 1;
    }
    return 1;
  }

  public normalvalue(mean = 0, sd = 1) {
    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
      this.distributions[this.address.column][this.address.row][this.call_index] =
        MC.Normal(this.iterations, { mean, sd, lhs: this.lhs });
    }
    else if (this.state === SimulationState.Simulation) {
      return this.distributions[this.address.column][this.address.row][this.call_index][this.iteration];
    }
    return MC.Normal(1, { mean, sd })[0];
  }

  public pertvalue(min = 0, mode = .5, max = 1, lambda = 4) {
    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
      this.distributions[this.address.column][this.address.row][this.call_index] =
        MC.PERT(this.iterations, { a: min, b: max, c: mode, lambda, lhs: this.lhs });
    }
    else if (this.state === SimulationState.Simulation) {
      return this.distributions[this.address.column][this.address.row][this.call_index][this.iteration];
    }
    return MC.PERT(1, { a: min, b: max, c: mode, lambda })[0];
  }

  public pertvalue_p(p10 = 0, mode = .5, p90 = 1, lambda = 4) {
    if (this.state === SimulationState.Prep) {
      const parms = MC.P80Pert(p10, p90, mode, lambda);
      this.InitDistribution();
      this.distributions[this.address.column][this.address.row][this.call_index] =
        MC.PERT(this.iterations, { ...parms, lambda, lhs: this.lhs });
    }
    else if (this.state === SimulationState.Simulation) {
      return this.distributions[this.address.column][this.address.row][this.call_index][this.iteration];
    }
    else {
      const parms = MC.P80Pert(p10, p90, mode, lambda);
      return MC.PERT(1, { ...parms, lambda })[0];
    }
  }

  public triangularvalue(min = 0, mode = .5, max = 1) {
    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
      this.distributions[this.address.column][this.address.row][this.call_index] =
        MC.Triangular(this.iterations, { a: min, b: max, c: mode, lhs: this.lhs });
    }
    else if (this.state === SimulationState.Simulation) {
      return this.distributions[this.address.column][this.address.row][this.call_index][this.iteration];
    }
    return MC.Triangular(1, { a: min, b: max, c: mode })[0];
  }

  public betavalue(a = 1, b = 1) {
    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
      this.distributions[this.address.column][this.address.row][this.call_index] =
        MC.Beta(this.iterations, { a, b, lhs: this.lhs });
    }
    else if (this.state === SimulationState.Simulation) {
      return this.distributions[this.address.column][this.address.row][this.call_index][this.iteration];
    }
    return MC.Beta(1, { a, b })[0];
  }

  public samplevalue(range: any[]) {
    return this.uniformrangesample(range);
  }

  public samplevalue_weighted(range: any[], weights: any[]) {

    // create a uniform distribution in {0,1}

    // we're not caching. why not? because we want to support variable
    // weights and values. not sure that that is a good idea, though.
    // without caching this function is slow.

    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
      this.distributions[this.address.column][this.address.row][this.call_index] =
        MC.Uniform(this.iterations, { min: 0, max: 1, lhs: this.lhs });
    }
    else {
      const r = (this.state === SimulationState.Simulation) ?
        this.distributions[this.address.column][this.address.row][this.call_index][this.iteration] :
        MC.Uniform(1, { min: 0, max: 1 })[0];

      // assume it's rectangular. if not, there's nothing we can do.

      if (!range || !range.length) return undefined;

      // FIXME: cache! [see above]

      const sum = // SpreadsheetFunctions.sum(weights);
        Utils.Flatten(weights).reduce((a: number, b: any) => {
          if (typeof b === 'undefined') return a;
          return a + Number(b);
        }, 0);

      const value = r * sum;
      let step = 0;

      for (let col = 0; col < range.length; col++) {
        for (let row = 0; row < range[col].length; row++) {
          step += weights[col][row];
          if (step >= value) {
            return range[col][row];
          }
        }
      }

      return range[0][0];

    }

  }

  public uniformrangesample(range: any[]) {

    // create a uniform distribution in {0,1}

    if (this.state === SimulationState.Prep) {
      this.InitDistribution();
      this.distributions[this.address.column][this.address.row][this.call_index] =
        MC.Uniform(this.iterations, { min: 0, max: 1, lhs: this.lhs });
    }
    else {
      const r = (this.state === SimulationState.Simulation) ?
        this.distributions[this.address.column][this.address.row][this.call_index][this.iteration] :
        MC.Uniform(1, { min: 0, max: 1 })[0];

      // assume it's rectangular. if not, there's nothing we can do.

      if (!range || !range.length) return undefined;

      // const count = range[0].length * range.length;
      // const index = Math.floor(count * r);

      const index = Math.floor(range[0].length * range.length * r);

      // const column = index % range.length;
      // const row = Math.floor(index / range.length);
      // const val = range[column][row];

      // FIXME: what should undefined look like?
      return range[index % range.length][Math.floor(index / range.length)] || '';

    }
  }

  // --- simulation functions --------------------------------------------------

  public simulationtrials() {
    return this.trials;
  }

  public simulationtime() {
    return this.elapsed / 1000;
  }

  public simulationvaluesarray(data?: number[]) {
    if (this.state !== SimulationState.Null) return 0;
    if (!data || !data.length) return { error: 'DATA' };
    return data;
  }

  public simulationvaluesarray_ordered(data?: number[], order_by?: number[]) {
    if (this.state !== SimulationState.Null) return 0;
    if (!data || !data.length) return { error: 'DATA' };
    if (!order_by || !order_by.length) return { error: 'DATA' };

    const tuples = Array.from(data).map((x, i) => [x, order_by[i]]);
    tuples.sort((a, b) => a[1] - b[1]);

    return tuples.map((tuple) => tuple[0]);
  }

  public simulationrsquared(dependent?: number[], independent?: number[]) {
    if (this.state !== SimulationState.Null) return 0;
    if (!dependent || !dependent.length || !independent || !independent.length) return { error: 'DATA' };
    return Stats.R2(dependent, independent);
  }

  public simulationcorrelation(a?: number[], b?: number[]) {
    if (this.state !== SimulationState.Null) return 0;
    if (!a || !a.length || !b || !b.length) return { error: 'DATA' };
    return Stats.Correlation(a, b);
  }

  public sortedsimulationindex(data?: number[], index = 1) {
    if (this.state !== SimulationState.Null) return 0;
    if (!data || !data.length) return { error: 'DATA' };
    if (index < 1 || index > data.length) return '#ARG';

    const pairs = Array.from(data).map((x, i) => [x, i + 1]);
    pairs.sort((a, b) => a[0] - b[0]);

    return pairs[index - 1][1];
  }

  public simulationvalue(data?: number[], index = 1) {
    if (this.state !== SimulationState.Null) return 0;
    if (!data || !data.length) return { error: 'DATA' };
    if (index < 1 || index > data.length) return '#ARG';
    return data[index - 1];
  }

  public simulationpercentile(data?: number[], percentile: number = .5) {
    if (this.state !== SimulationState.Null) return 0;
    if (!data || !data.length) return { error: 'DATA' };
    return Stats.Percentile(data, percentile);
  }

  public simulationstandarddeviation(data?: number[]) {
    if (this.state !== SimulationState.Null) return 0;
    if (!data || !data.length) return { error: 'DATA' };
    const stats = Stats.Statistics(data);
    return stats.stdev;
  }

  public simulationvariance(data?: number[]) {
    if (this.state !== SimulationState.Null) return 0;
    if (!data || !data.length) return { error: 'DATA' };
    const stats = Stats.Statistics(data);
    return stats.variance;
  }

  public simulationskewness(data?: number[]) {
    if (this.state !== SimulationState.Null) return 0;
    if (!data || !data.length) return { error: 'DATA' };
    const stats = Stats.Statistics(data);
    return stats.skewness;
  }

  public simulationkurtosis(data?: number[]) {
    if (this.state !== SimulationState.Null) return 0;
    if (!data || !data.length) return { error: 'DATA' };
    const stats = Stats.Statistics(data);
    return stats.kurtosis;
  }

  public simulationinterval(data?: number[], min?: number, max?: number) {
    if (this.state !== SimulationState.Null) return 0;
    if (!data || !data.length) return { error: 'DATA' };
    return Stats.Interval({ data, min, max });
  }

  public simulationstandarderror(data?: number[]) {

    if (this.state !== SimulationState.Null) return 0;
    if (!data || !data.length) return { error: 'DATA' };

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

    return (Math.sqrt(variance / data.length)) / Math.sqrt(data.length);

  }

  public simulationmin(data?: number[]) {
    if (this.state !== SimulationState.Null) return 0;
    if (!data || !data.length) return { error: 'DATA' };
    return Math.min.apply(0, data);
  }

  public simulationmax(data?: number[]) {
    if (this.state !== SimulationState.Null) return 0;
    if (!data || !data.length) return { error: 'DATA' };
    return Math.max.apply(0, data);
  }

  public simulationmean(data?: number[]) {
    if (this.state !== SimulationState.Null) return 0;
    if (!data || !data.length) return { error: 'DATA' };

    // return data.reduce((a: number, b: number) => a + b, 0) / data.length;
    let sum = 0;
    for (const value of data) sum += value;
    return sum / data.length;

  }

  public simulationmedian(data?: number[]) {
    if (this.state !== SimulationState.Null) return 0;
    if (!data || !data.length) return { error: 'DATA' };

    const copy = data.filter((element: any) => typeof element === 'number' ? element : 0);
    copy.sort((a: number, b: number) => a - b);
    return copy[Math.round(copy.length / 2)];

  }

  // --- special ---

  public cell(type: string, reference: any) {
    switch (type.toLowerCase()) {
      case 'address':
        return reference;
        break;
    }
    return '#NOTIMPL';
  }

}

// instance

export const Model = new SimulationModel();

// ---


FunctionLibrary.Register({

  // this is based on model because it uses address;
  // FIXME consolidate types so this can go in the base object

  Cell: {
    description: 'Returns data about a cell',
    address: [1],
    arguments: [
      { name: 'type', description: 'Type of data to return' },
      { name: 'reference', description: 'Cell reference' },
    ],
    fn: Model.cell.bind(Model),
  },

  // mv distributions

  'Multivariate.Normal': {
    description: 'Returns a sample from the multivariate normal distribution',
    simulation_volatile: true,
    address: [0],
    arguments: [
      { name: 'range of values', description: 'Set of Correlated Distributions (N)' },
      { name: 'correlation', description: 'Correlation Matrix (NxN)' },
      { name: 'mean', description: 'Distribution Mean', default: 0 },
      { name: 'stdev', description: 'Standard Deviation', default: 1 },
    ],
    fn: Model.multivariate_normal.bind(Model),
  },

  'Multivariate.Uniform': {
    description: 'Returns a sample from the multivariate uniform distribution',
    simulation_volatile: true,
    address: [0],
    arguments: [
      { name: 'range of values', description: 'Set of Correlated Distributions (N)' },
      { name: 'correlation', description: 'Correlation Matrix (NxN)' },
      { name: 'min', description: 'Minimum Value', default: 0 },
      { name: 'max', description: 'Maximum Value', default: 1 },
    ],
    fn: Model.multivariate_uniform.bind(Model),
  },

  'Multivariate.Beta': {
    description: 'Returns a sample from the multivariate beta distribution',
    simulation_volatile: true,
    address: [0],
    arguments: [
      { name: 'range of values', description: 'Set of Correlated Distributions (N)' },
      { name: 'correlation', description: 'Correlation Matrix (NxN)' },
      { name: 'w', description: 'Shape Parameter' },
      { name: 'v', description: 'Shape Parameter' },
    ],
    fn: Model.multivariate_beta.bind(Model),
  },

  'Multivariate.PERT': {
    description: 'Returns a sample from the multivariate PERT distribution',
    simulation_volatile: true,
    address: [0],
    arguments: [
      { name: 'range of values', description: 'Set of Correlated Distributions (N)' },
      { name: 'correlation', description: 'Correlation Matrix (NxN)' },
      { name: 'min', description: 'Minimum Value' },
      { name: 'mode', description: 'Most-Likely Value' },
      { name: 'max', description: 'Maximum Value' },
      { name: 'lambda', default: 4 },
    ],
    fn: Model.multivariate_pert.bind(Model),
  },

  'Multivariate.Triangular': {
    description: 'Returns a sample from the multivariate triangular distribution',
    simulation_volatile: true,
    address: [0],
    arguments: [
      { name: 'range of values', description: 'Set of Correlated Distributions (N)' },
      { name: 'correlation', description: 'Correlation Matrix (NxN)' },
      { name: 'min', description: 'Minimum Value' },
      { name: 'mode', description: 'Most-Likely Value' },
      { name: 'max', description: 'Maximum Value' },
    ],
    fn: Model.multivariate_triangular.bind(Model),
  },

  // basic distributions

  UniformRangeSample: {
    description: 'Returns one of a set of values, with equal probability and with replacement',
    simulation_volatile: true,
    arguments: [
      { name: 'range', description: 'Range of Values' },
    ],
    fn: Model.uniformrangesample.bind(Model),
  },

  SampleValue: {
    description: 'Returns one of a set of values, with equal probability and with replacement',
    simulation_volatile: true,
    arguments: [
      { name: 'range', description: 'Range of Values' },
    ],
    fn: Model.samplevalue.bind(Model),
  },

  'SampleValue.Weighted': {
    description: 'Returns one of a set of values, with equal probability and with replacement',
    simulation_volatile: true,
    arguments: [
      { name: 'range', description: 'Range of Values' },
    ],
    fn: Model.samplevalue_weighted.bind(Model),
  },

  BernoulliValue: {
    description: 'Returns true or false (boolean) based on the given probability',
    simulation_volatile: true,
    arguments: [
      { name: 'p', description: 'Probability to return True', default: 0.5 },
    ],
    fn: Model.bernoullivalue.bind(Model),
  },

  ProbabilityValue: {
    description: 'Returns true or false (boolean) based on the given probability',
    simulation_volatile: true,
    arguments: [
      { name: 'p', description: 'Probability to return True', default: 0.5 },
    ],
    fn: Model.probabilityvalue.bind(Model),
  },

  UniformValue: {
    description: 'Returns a sample from the uniform distribution',
    simulation_volatile: true,
    arguments: [
      { name: 'min', description: 'Minimum', default: 0 },
      { name: 'max', description: 'Maximum', default: 1 },
    ],
    fn: Model.uniformvalue.bind(Model),
  },

  BetaValue: {
    description: 'Returns a sample from the beta distribution',
    simulation_volatile: true,
    arguments: [
      { name: 'w', description: 'Shape Parameter' },
      { name: 'v', description: 'Shape Parameter' },
    ],
    fn: Model.betavalue.bind(Model),
  },

  NormalValue: {
    description: 'Returns a sample from the normal distribution',
    simulation_volatile: true,
    arguments: [
      { name: 'mean', description: 'Mean', default: 0 },
      { name: 'stdev', description: 'Standard Deviation', default: 1 },
    ],
    fn: Model.normalvalue.bind(Model),
  },

  SequentialValue: {
    description: 'Returns one from a set of values, in order',
    simulation_volatile: true,
    arguments: [
      { name: 'values', description: 'Data Array' },
      { name: 'count', description: 'Count', default: 0 },
    ],
    fn: Model.sequentialvalue.bind(Model),
  },

  IndexValue: {
    description: 'Returns a monotonically increasing value',
    simulation_volatile: true,
    arguments: [
      { name: 'max', description: 'Maximum', default: 0 },
    ],
    fn: Model.indexvalue.bind(Model),
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
    fn: Model.pertvalue_p.bind(Model),
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
    fn: Model.pertvalue.bind(Model),
  },

  TriangularValue: {
    description: 'Returns a sample from the triangular distribution',
    simulation_volatile: true,
    arguments: [
      { name: 'min', description: 'Minimum Value', default: 0 },
      { name: 'mode', description: 'Most Likely Value', default: 0.5 },
      { name: 'max', description: 'Maximum Value', default: 1 },
    ],
    fn: Model.triangularvalue.bind(Model),
  },

  // stats

  SimulationCorrelation: {
    description: 'Returns the correlation between the data from two cells in the simulation',
    arguments: [
      { name: 'reference cell', description: 'Cell 1' },
      { name: 'reference cell', description: 'Cell 2' },
    ],
    collector: [0, 1],
    fn: Model.simulationcorrelation.bind(Model),
  },

  SimulationRSquared: {
    // tslint:disable-next-line:max-line-length
    description: 'Returns the r-squared value (coefficient of correlation) of the data from two cells in the simulation',
    arguments: [
      { name: 'dependent', description: 'Dependent Value' },
      { name: 'independent', description: 'Indepdendent Value' },
    ],
    collector: [0, 1],
    fn: Model.simulationrsquared.bind(Model),
  },

  SimulationSkewness: {
    description: 'Returns the skewness of data from this cell in the simulation',
    arguments: [
      { name: 'reference cell', description: 'Source Cell' },
    ],
    collector: [0],
    fn: Model.simulationskewness.bind(Model),
  },

  SimulationKurtosis: {
    description: 'Returns the kurtosis (peakedness) of data from this cell in the simulation',
    arguments: [
      { name: 'reference cell', description: 'Source Cell' },
    ],
    collector: [0],
    fn: Model.simulationkurtosis.bind(Model),
  },

  SimulationPercentile: {
    description: 'Returns the value of a cell at a given percentile in the simulation',
    arguments: [
      { name: 'reference cell', description: 'Source Cell' },
      { name: 'percentile', description: 'Percentile (as %)' },
    ],
    collector: [0],
    fn: Model.simulationpercentile.bind(Model),
  },

  SimulationInterval: {
    description: 'Returns the portion of results in the simulation that fall within some bounds (as a percentage)',
    arguments: [
      { name: 'reference cell', description: 'Source Cell' },
      { name: 'min', description: 'Minimum Value (optional, inclusive)' },
      { name: 'max', description: 'Maximum Value (optional, inclusive)' },
    ],
    collector: [0],
    fn: Model.simulationinterval.bind(Model),
  },

  SimulationMean: {
    description: 'Returns the mean (average) value of the data from this cell in the simulation',
    arguments: [
      { name: 'reference cell', description: 'Source Cell' },
    ],
    collector: [0],
    fn: Model.simulationmean.bind(Model),
  },

  SimulationValue: {
    description: 'Returns the value of this cell in the simulation at the given trial number',
    arguments: [
      { name: 'reference cell', description: 'Source Cell' },
      { name: 'iteration', description: 'Trial Number' },
    ],
    collector: [0],
    fn: Model.simulationvalue.bind(Model),
  },

  SimulationValuesArray: {
    description: 'Returns all value of this cell in the simulation, as an array',
    arguments: [
      { name: 'reference cell', description: 'Source Cell' },
    ],
    collector: [0],
    fn: Model.simulationvaluesarray.bind(Model),
  },

  SortedSimulationIndex: {
    description: 'Returns the iteration number of a sorted value for this cell',
    arguments: [
      { name: 'reference cell', description: 'Source Cell' },
    ],
    collector: [0],
    fn: Model.sortedsimulationindex.bind(Model),
  },

  'SimulationValuesArray.Ordered': {
    description: 'Returns all value of this cell in the simulation, as an array, ordered by a second cell',
    arguments: [
      { name: 'reference cell', description: 'Source Cell' },
      { name: 'order by', description: 'Reference Cell for Ordering' },
    ],
    collector: [0, 1],
    fn: Model.simulationvaluesarray_ordered.bind(Model),
  },

  SimulationMin: {
    description: 'Returns the minimum value of the data from this cell in the simulation',
    arguments: [
      { name: 'reference cell', description: 'Source Cell' },
    ],
    collector: [0],
    fn: Model.simulationmin.bind(Model),
  },

  SimulationMax: {
    description: 'Returns the maximum value of the data from this cell in the simulation',
    arguments: [
      { name: 'reference cell', description: 'Source Cell' },
    ],
    collector: [0],
    fn: Model.simulationmax.bind(Model),
  },

  SimulationStandardError: {
    description: 'Returns the standard error of the mean from this cell in the simulation',
    arguments: [
      { name: 'reference cell' },
    ],
    collector: [0],
    fn: Model.simulationstandarderror.bind(Model),
  },

  SimulationStandardDeviation: {
    description: 'Returns the standard deviation of the data from this cell in the simulation',
    arguments: [
      { name: 'reference cell', description: 'Source Cell' },
    ],
    collector: [0],
    fn: Model.simulationstandarddeviation.bind(Model),
  },

  SimulationVariance: {
    description: 'Returns the variance of the data from this cell in the simulation',
    arguments: [
      { name: 'reference cell', description: 'Source Cell' },
    ],
    collector: [0],
    fn: Model.simulationvariance.bind(Model),
  },

  // special

  SimulationTrials: {
    description: 'Returns the number of trials from the last simulation',
    fn: Model.simulationtrials.bind(Model),
  },

  SimulationTime: {
    description: 'Returns the elapsed time of the last simulation',
    fn: Model.simulationtime.bind(Model),
  },

  // some extra random functions, available because we have the matrix classes

  IsPosDef: {
    description: 'Checks that a matrix is positive-definite',
    arguments: [{ name: 'matrix' }],
    fn: (mat: number[][]) => {
      if (mat.some((arr) => {
        return arr.some((v) => typeof v !== 'number');
      })) return '#VALUE';
      const m = Matrix.FromArray(mat);
      return m.IsPosDef();
    },
  },

  Cholesky: {
    arguments: [{ name: 'matrix' }, { name: 'transpose', default: false }],
    fn: (mat: number[][], transpose = false) => {
      return Matrix.FromArray(mat).Cholesky(transpose).ToArray();
    },
  },

  EigenValues: {
    description: 'Returns the eigenvalues of the matrix (as column vector)',
    arguments: [{ name: 'matrix' }],
    fn: (mat: number[][]) => {

      if (mat.some((arr) => {
        return arr.some((v) => typeof v !== 'number');
      })) return '#VALUE';

      const m = Matrix.FromArray(mat);
      const e = m.EigenSystem();
      return e.realvalues;
    },

  },

  EigenVectors: {
    description: 'Returns the eigenvectors of the matrix (as matrix)',
    arguments: [{ name: 'matrix' }],
    fn: (mat: number[][]) => {

      if (mat.some((arr) => {
        return arr.some((v) => typeof v !== 'number');
      })) return '#VALUE';

      const m = Matrix.FromArray(mat);
      const e = m.EigenSystem();
      return e.vectors;
    },

  },

});

