
export type PrimitiveBinaryExpression = (a: number|object, b: number|object) => number|object|boolean;

// NOTE: I perf tested these in chrome, and it was a wash. the imperative
// functions are maybe a little faster in ffx. I have not tested IE11 but
// that's basically the reason we are using the explicit ones.

/*
export const Validate = (fn: (x: any, y: any) => any, a: number|object, b: number|object) => {
  if (typeof a === 'object') return a;
  if (typeof b === 'object') return b;
  return fn(a, b);
};

export const Add = Validate.bind(0, (x: any, y: any) => x + y);
export const Subtract = Validate.bind(0, (x: any, y: any) => x - y);

*/

export const Add = (a: number|object, b: number|object) => {
  if (typeof a === 'object') return a;
  if (typeof b === 'object') return b;
  return a + b;
};

export const Subtract = (a: number|object, b: number|object) => {
  if (typeof a === 'object') return a;
  if (typeof b === 'object') return b;
  return a - b;
};

export const Modulo = (a: number|object, b: number|object) => {
  if (typeof a === 'object') return a;
  if (typeof b === 'object') return b;
  return a % b;
};

export const Multiply = (a: number|object, b: number|object) => {
  if (typeof a === 'object') return a;
  if (typeof b === 'object') return b;
  return a * b;
};

export const Divide = (a: number|object, b: number|object) => {
  if (typeof a === 'object') return a;
  if (typeof b === 'object') return b;
  return a / b;
};

export const Power = (a: number|object, b: number|object) => {
  if (typeof a === 'object') return a;
  if (typeof b === 'object') return b;
  return Math.pow(a, b);
};

export const GreaterThan = (a: number|object, b: number|object) => {
  if (typeof a === 'object') return a;
  if (typeof b === 'object') return b;
  return a > b;
};

export const LessThan = (a: number|object, b: number|object) => {
  if (typeof a === 'object') return a;
  if (typeof b === 'object') return b;
  return a < b;
};

export const GreaterThanEquals = (a: number|object, b: number|object) => {
  if (typeof a === 'object') return a;
  if (typeof b === 'object') return b;
  return a >= b;
};

export const LessThanEquals = (a: number|object, b: number|object) => {
  if (typeof a === 'object') return a;
  if (typeof b === 'object') return b;
  return a <= b;
};

export const Equals = (a: number|object|string, b: number|object|string) => {
  if (typeof a === 'object') return a;
  if (typeof b === 'object') return b;

  // special case: empty string === undefined
 
  if (typeof a === 'undefined' && b === '') { return true; }
  if (typeof b === 'undefined' && a === '') { return true; }

  // tslint:disable-next-line: triple-equals
  return a == b;
};

export const NotEquals = (a: number|object|string, b: number|object|string) => {
  if (typeof a === 'object') return a;
  if (typeof b === 'object') return b;

  // special case: empty string === undefined

  if (typeof a === 'undefined' && b === '') { return false; }
  if (typeof b === 'undefined' && a === '') { return false; }

  // tslint:disable-next-line: triple-equals
  return a != b;
};

export const Identity = (a: any) => a;

export const Inverse = (a: number|object) => {
  if (typeof a === 'object') return a;
  return -a;
};

export const MapOperator = (operator: string) => {

  switch (operator){
    case '+': return Add;
    case '-': return Subtract;
    case '*': return Multiply;
    case '/': return Divide;
    case '^': return Power;
    case '%': return Modulo;
    case '>': return GreaterThan;
    case '<': return LessThan;
    case '>=': return GreaterThanEquals;
    case '<=': return LessThanEquals;
    case '=':   return Equals;
    case '==':  return Equals;
    case '!==': return NotEquals;
    case '<>':  return NotEquals;
  }

  return undefined;

};
