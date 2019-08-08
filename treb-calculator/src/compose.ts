
type BaseFunction = (...args: any) => any;

export const compose = (...fns: BaseFunction[]) => fns.reduce((f, g) => (...args) => f(g(...args)));
export const pipe = (...fns: BaseFunction[]) => compose.apply(undefined, fns.reverse());
