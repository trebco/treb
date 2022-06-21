
import type { 
  ExtendedFunctionDescriptor, CompositeFunctionDescriptor,
  FunctionMap, ExtendedFunctionMap } from './descriptors';

/**
 * singleton (static instance) of function library; includes utility methods
 */
export class FunctionLibrary {

  /** the actual functions */
  protected functions: ExtendedFunctionMap = {};

  /**
   * register one or more functions. keys in the passed object are
   * considered the canonical function names, and must be (icase) unique.
   */
  public Register(...maps: FunctionMap[]): void {

    for (const map of maps) {

      for (const name of Object.keys(map)) {

        // some rules for names. the length thing is arbitrary, but come on.
        // leading ascii-letter is also kind of arbitrary, but it can't be
        // a number. the legal characters thing is probably broken: we should
        // allow extended characters.

        if (/[^a-zA-Z0-9._]/.test(name)) {
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

  }

  /** lookup function (actual map is protected) */
  public Get(name: string) {
    const normalized = name.toLowerCase();
    return this.functions[normalized];
  }

  /** get a list, for AC services */
  public List() {
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
  public Alias(name: string, reference: string) {
    const ref = this.Get(reference);
    if (!ref) {
      throw new Error(`referenced function ${reference} does not exist`);
    }
    this.Register({[name]: {...ref} as CompositeFunctionDescriptor});
  }

}
