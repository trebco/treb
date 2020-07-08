
export enum ErrorType {
  Argument =    'ARG',
  Data =        'DATA',
  Reference =   'REF',
  Name =        'NAME',
  Expression =  'EXPR',
  Value =       'VALUE',
  Unknown =     'UNK',
  NotImpl =     'NOTIMPL',
  Div0 =        'DIV/0',
}

export interface FunctionError {
  error: ErrorType;
}

export const ArgumentError: FunctionError = { error: ErrorType.Argument };
export const ReferenceError: FunctionError = { error: ErrorType.Reference };
export const ExpressionError: FunctionError = { error: ErrorType.Expression };
export const NameError: FunctionError = { error: ErrorType.Name };
export const ValueError: FunctionError = { error: ErrorType.Value };
export const DataError: FunctionError = { error: ErrorType.Data };
export const DivideByZeroError: FunctionError = { error: ErrorType.Div0 };
export const UnknownError: FunctionError = { error: ErrorType.Unknown };
export const NotImplError: FunctionError = { error: ErrorType.NotImpl };

/** type guard function */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const IsError = (test: any): test is FunctionError => {
  return test && test.error && (
    test.error === ErrorType.Argument ||
    test.error === ErrorType.Reference ||
    test.error === ErrorType.Name ||
    test.error === ErrorType.Expression ||
    test.error === ErrorType.Data ||
    test.error === ErrorType.Unknown ||
    test.error === ErrorType.NotImpl ||
    test.error === ErrorType.Value ||
    test.error === ErrorType.Div0
  );
};
