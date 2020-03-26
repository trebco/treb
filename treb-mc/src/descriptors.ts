
import { ArgumentDescriptor, CompositeFunctionDescriptor } from 'treb-calculator/src/descriptors';

export interface MCArgumentDescriptor extends ArgumentDescriptor {

  /**
   * collect results for this argument (should be a reference).
   * FIXME: MC calculator only
   */
  collector?: boolean;

}

export interface MCCompositeFunctionDescriptor extends CompositeFunctionDescriptor {

  /**
   * volatile during a simulation only
   * FIXME: MC calculator only
   */
  simulation_volatile?: boolean;

  arguments?: MCArgumentDescriptor[];

}

export interface MCFunctionMap {
  [index: string]: MCCompositeFunctionDescriptor;
}
