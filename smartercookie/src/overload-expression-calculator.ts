
import { ExpressionCalculator, ExtendedExpressionUnit } from 'treb-calculator/src/expression-calculator';
import { FunctionLibrary } from 'treb-calculator/src/function-library';
import { ExtendedFunctionDescriptor } from 'treb-calculator/src/descriptors';

import { Cell, Cells, ICellAddress, ValueType, GetValueType,
         Area, UnionValue, CellValue,
         ArrayUnion,
         NumberUnion,
         UndefinedUnion,
         ComplexUnion} from 'treb-base-types';
import { Parser, ExpressionUnit, UnitBinary, UnitIdentifier,
         UnitGroup, UnitUnary, UnitAddress, UnitRange, UnitCall } from 'treb-parser';
import { DataModel, MacroFunction } from 'treb-grid';

import { NameError, ReferenceError, ExpressionError, UnknownError } from 'treb-calculator/src/function-error';
// import { ReturnType } from './descriptors';
// import * as Primitives from 'treb-calculator/src/primitives';
import * as Primitives from './overload-primitives';
import { FunctionLibrary as OverloadLibrary } from './functions';

export class OverloadExpressionCalculator extends ExpressionCalculator {

  constructor(library: FunctionLibrary, parser: Parser) {
    super(library, parser);

    // the standard Register routine doesn't allow overloading.
    // library.Register(OverloadLibrary);

    for (const name of Object.keys(OverloadLibrary)) {
      const normalized = name.toLowerCase();
      const descriptor = OverloadLibrary[name] as ExtendedFunctionDescriptor;
      descriptor.canonical_name = name;
      (library as any).functions[normalized] = descriptor;
    }
  }

  protected BinaryExpression(x: UnitBinary): (expr: UnitBinary) => UnionValue /*UnionOrArray*/ {

    // we are constructing and caching functions for binary expressions.
    // this should simplify calls when parameters change. eventually I'd
    // like to do this for other dynamic calls as well...

    // the idea is that we can start composing compound expressions. still
    // not sure if that will work (or if it's a good idea).

    // NOTE (for the future?) if one or both of the operands is a literal,
    // we can bind that directly. literals in the expression won't change
    // unless the expression changes, which will discard the generated
    // function (along with the expression itself).

    const fn = Primitives.MapOperator(x.operator);

    if (!fn) {
      return () => { // expr: UnitBinary) => {
        console.info(`(unexpected binary operator: ${x.operator})`);
        return ExpressionError();
      };
    }
    else {
      return (expr: UnitBinary) => {

        // sloppy typing, to support operators? (...)

        const left = this.CalculateExpression(expr.left as ExtendedExpressionUnit);
        const right = this.CalculateExpression(expr.right as ExtendedExpressionUnit);

        // check for arrays. do elementwise operations.

        if (left.type === ValueType.array) {
          if (right.type === ValueType.array) {
            return this.ElementwiseBinaryExpression(fn, left as ArrayUnion, right as ArrayUnion);
          }
          return this.ElementwiseBinaryExpression(fn, left as ArrayUnion, {type: ValueType.array, value: [[right]]});
        }
        else if (right.type === ValueType.array) {
          return this.ElementwiseBinaryExpression(fn, {type: ValueType.array, value: [[left]]}, right as ArrayUnion);
        }
        
        return fn(left, right);

      };
    }

  }

}
