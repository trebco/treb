
export interface Config {

  /** root of declaration dir, relative to config file */
  root: string;

  /** starting point for docs, relative to root */
  index: string;

  /** output file relative to config file (or stdout) */
  output?: string;

  /** package.json for version information */
  package: string;

  /** drop these types, even if they're exported */
  drop_types: string[];

  /** keep variables of this type but change to any */
  convert_to_any: string[];

  /** exclude via jsdoc tags. typically "internal" */
  exclude_tags: string[];

  /** drop generics */
  drop_generics: string[];

  /** rename types */
  rename_types: Record<string, string>;

  /** additional files to include. these will be concatenated to the generated output. */
  include: string[];

  /** map declaration files directly (by prefix) */
  map: Record<string, string>;

  /** turn enums into union types. this helps import. */
  flatten_enums: boolean;

}


export interface ReadTypeArgs {
  /** 
  * types we are looking for. if this is missing, we will colllect
  * all types that are exported and public (TODO: also not @internal) 
  */
  types?: string[],

  /** dependencies, with target types */
  recursive_targets: Record<string, string[]>,

  /** ... */
  imported_types: Record<string, string>,

  /** 
   * this has to change, because we may collect reference types
   * from types which we don't actually want (the owner/parent).
   * however, we don't know ahead of time because the (owner/parent)
   * type may be referenced later...
   * 
   * so this is a map of who references it -> the reference. we 
   * can collapse this list later once we decide what we actually want
   * to keep.
   * 
   * actually let's keep both records...
   */
  referenced_type_map: Record<string, string[]>,

  /** types we will need, from the imports (probably) */
  referenced_types: Record<string, number>,

  /** types we have resolved (we can stop looking for them) */
  found_types: Record<string, string>,

  /** ... */
  extra_types: Record<string, string>,

  /** exported variables */
  exported_variables: string[],

}
