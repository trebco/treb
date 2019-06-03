
/**
 * descriptor for an individual argument
 */
export interface ArgumentDescriptor {
  name?: string;
  description?: string;
  default?: any;
}

/**
 * merging the old function descriptor and decorated function types, since
 * there's a good deal of overlap and we spend a lot of effort keeping them
 * in sync.
 *
 * this is a wrapper object that contains the function and (mostly optional)
 * metadata.
 */
export interface CompositeFunctionDescriptor {

  /**
   * description for the function wizard
   */
  description?: string;

  /**
   * list of arguments, for the function wizard and tooltip
   */
  arguments?: ArgumentDescriptor[];

  /**
   * volatile: value changes on every recalc, even if dependencies
   * don't change
   */
  volatile?: boolean;

  /**
   * volatile during a simulation only
   * FIXME: MC calculator only
   */
  simulation_volatile?: boolean;

  /**
   * collect results for the given argument (should be a reference)
   * FIXME: MC calculator only
   */
  collector?: number[];

  /**
   * allows error values to propagate. otherwise, a function will
   * return an #ARG error if any arguments contain errors. used for
   * IsError and IfError, atm
   */
  allow_error?: number[];

  /**
   * the given argument (reference) should be treated as an address,
   * not resolved. this allows us to support IsError and related functions,
   * otherwise they would return #ARG errors
   */
  address?: number[];

  /**
   * the actual function. if this is an object member and needs access
   * to the containing instance, make sure to bind it to that instance.
   */
  fn: (...args: any[]) => any;

}

export interface FunctionMap {
  [index: string]: CompositeFunctionDescriptor;
}

/**
 * the stored value also includes a canonical name. this used to be separate
 * from the registered name (because those were functions, and had to adhere
 * to language rules) but now we use arbitrary tokens, so we can consolidate.
 */
interface ExtendedFunctionDescriptor extends CompositeFunctionDescriptor {
  canonical_name: string;
}

interface ExtendedFunctionMap {
  [index: string]: ExtendedFunctionDescriptor;
}


/**
 * singleton (static instance) of function library; includes utility methods
 */
export class FunctionLibrary {

  /**
   * register one or more functions. keys in the passed object are
   * considered the canonical function names, and must be (icase) unique.
   */
  public static Register(map: FunctionMap) {

    for (const name of Object.keys(map)) {

      // some rules for names. the length thing is arbitrary, but come on.
      // leading ascii-letter is also kind of arbitrary, but it can't be
      // a number. the legal characters thing is probably broken: we should
      // allow extended characters.

      if (/[^a-zA-Z0-9\._]/.test(name)) {
        throw new Error('invalid function name (invalid character)');
      }

      if (name.length > 255) {
        throw new Error('invalid function name (too long, > 255)');
      }

      if (/^[^a-zA-Z]/.test(name)) {
        throw new Error('invalid function name (start with an ascii letter)');
      }

      const normalized = name.toLowerCase();
      if (this.functions[normalized]) {
        throw new Error(`function name (${normalized}) is already in use`);
      }

      const descriptor = map[name] as ExtendedFunctionDescriptor;
      descriptor.canonical_name = name;

      this.functions[normalized] = descriptor;
    }
  }

  /** lookup function (actual map is protected) */
  public static Get(name: string) {
    const normalized = name.toLowerCase();
    return this.functions[normalized];
  }

  /** get a list, for AC services */
  public static List() {
    const list: ExtendedFunctionMap = {};
    for (const key of Object.keys(this.functions)) {
      list[key] = this.functions[key];
    }
    return list;
  }

  /**
   * create an alias. we clone the descriptor and use the alias as the
   * canonical name, so should work better than just a pointer.
   */
  public static Alias(name: string, reference: string) {
    const ref = this.Get(reference);
    if (!ref) {
      throw new Error(`referenced function ${reference} does not exist`);
    }
    this.Register({[name]: {...ref} as CompositeFunctionDescriptor});
  }

  /** the actual functions */
  protected static functions: ExtendedFunctionMap = {};

}
