/**
 * This file is part of TREB.
 * Copyright 2022 trebco, llc.
 * info@treb.app
 */

/**
 * UPDATE: dropping dispatch altogether. there were really very few 
 * cases where queue length > 1, so it seems like unecessary overhead.
 * 
 * it's still somewhat useful to have an interface, in the event we 
 * change this again, so keep using the Yield() function.
 * 
 * TODO: is anyone using the callback version? could drop...
 * 
 * I'm guessing no one uses it, because it's broken amd we never noticed
 */

/* *
 * yield and then call the passed function
 * /
export function Yield(fn: () => void): void;

/ * *
 * returns a promise that resolves after yield
 * /
export function Yield(): Promise<void>;

/ * * implementation * /
export function Yield(fn?: () => void) {
  return fn ? Promise.resolve().then(fn) : Promise.resolve();
}
*/

/* for perf testing, we don't need this anymore
(self as any).__dispatcher_instance = {
  Call: Yield
}
*/

export const Yield = () => Promise.resolve();

