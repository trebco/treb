
enum ErrorType {
  Argument =    'ARG',
  Data =        'DATA',
  Reference =   'REF',
  Name =        'NAME',
  Expression =  'EXPR',
  Value =       'VALUE',
  Unknown =     'UNK',
  NotImpl =     'NOTIMPL',
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
export const UnknownError: FunctionError = { error: ErrorType.Unknown };
export const NotImplError: FunctionError = { error: ErrorType.NotImpl };

/** type guard function */
export const IsError = (test: any): test is FunctionError => {
  return test && test.error && (
    test.error === ErrorType.Argument ||
    test.error === ErrorType.Reference ||
    test.error === ErrorType.Name ||
    test.error === ErrorType.Expression ||
    test.error === ErrorType.Data ||
    test.error === ErrorType.Unknown ||
    test.error === ErrorType.NotImpl ||
    test.error === ErrorType.Value
  );
};
