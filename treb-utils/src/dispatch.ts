
// eslint-disable-next-line @typescript-eslint/interface-name-prefix
interface IDispatcher {
  Call: (fn: () => void) => void;
}

/**
 * this is a yielding callback function, like requestAnimationFrame but
 * (theoretically) faster. I'm starting to wonder if it's actually that
 * fast, if lots of things are reading messages (because everyone now uses
 * this mechanism).
 * 
 * did some perf testing and this is pretty good -- Promise.resolve() is 
 * faster (especially in firefox) but not by much, and there's native support
 * in IE11 (is that right?)
 *
 * FIXME: move out of base types. this requires a window.
 * FIXME: or, potentially use nextTick or setImmediate if there's no window.
 */
class Dispatcher implements IDispatcher {

  /** id for comparing messages. not intended to be secure. */
  private id = Math.random();

  /** pending tx flag, in case there are multiple messages passed before we switch contexts */
  private tx = false;

  /** queued callbacks */
  private queue: Array<() => void> = [];

  /** sigh... IE11 */
  private base_uri: string;

  /**
   * static init. note that there's a possibility this gets initialized
   * multiple times because of separate includes in build modules. we should
   * try to unify (global object? meh)
   */
  constructor() {

    this.base_uri = document.baseURI ? document.baseURI :
      document.location.origin;

    if (/^file:\/\//.test(this.base_uri)) this.base_uri = '*';

    if ((self as any).window) {
      window.addEventListener('message', (event: MessageEvent) => {
        if (event.source === window && event.data === this.id) {

          // note the order of operations here: we first pull all the
          // callbacks, clear the list, and unset the flag. that's because
          // one of the callbacks might have another call to Dispatch().

          // this way that subsequent call won't get handled until the
          // next pass through postMessage.

          const list = this.queue.slice(0);
          this.queue = [];
          this.tx = false;
          for (const fn of list) { fn(); }
        }
      });
    }
  }

  /**
   * call a function with the yielding callback. be sure to use arrow functions
   * to ensure `this` is bound properly in the callback.
   */
  public Call(fn: () => void) {
    this.queue.push(fn);
    if (!this.tx) {
      this.tx = true;

      // I don't know if it might be cheaper to use '*' instead of baseURI.
      // we don't need this protection because we are === checking window
      // in the event handler.

      window.postMessage(this.id, this.base_uri || '');
    }
  }

}

let local_instance: IDispatcher;

if (typeof self !== 'undefined') {

  // singleton, but protected against multiple copies of this module
  // inlined in different builds. unfortunately we have to pollute the
  // global object (FIXME: accessor?)
  //
  // NOTE: I haven't seen any cases where there are multiple instances.
  // webpack seems to be managing this OK. we could probably safely drop
  // the global.

  local_instance = (self as any).__dispatcher_instance;
  if (!local_instance) {
    if ((self as any).window) {

      // console.info('creating new dispatcher (3)');
      local_instance = new Dispatcher();
      Object.defineProperty(self, '__dispatcher_instance', {
        value: local_instance,
      });


    }
  }
  else {
    // console.info('using existing dispatcher (4)');
  }

}
else {

  local_instance = {
    Call: () => { console.info('jjo'); },
  }

}

/**
 * yield and then call the passed function
 */
export function Yield(fn: () => void): void;

/**
 * returns a promise that resolves after yield
 */
export function Yield(): Promise<void>;

export function Yield(fn?: () => void) {
  if (!fn) return new Promise<void>((resolve) => local_instance.Call(resolve));
  local_instance.Call(fn);
}
