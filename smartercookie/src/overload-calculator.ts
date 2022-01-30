
// this will move to a new subdir eventually so we can enforce isolation

import { Calculator } from 'treb-calculator';
import { OverloadExpressionCalculator } from './overload-expression-calculator';

export class OverloadCalculator extends Calculator {

  // local reference
  protected overload_expression_calculator: OverloadExpressionCalculator;

  constructor() {
    super();

    this.expression_calculator =
      this.overload_expression_calculator =
        new OverloadExpressionCalculator(
          this.library,
          this.parser);

    // any special functions
    // ...
      
  }

}

