
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { config as config_data } from './api-config';

interface Config {

  // root of declaration dir
  root: string;

  // starting point for docs
  index: string;

  // output file
  output: string;

  // package.json
  package: string;

  drop_types: string[];

  convert_to_any: string[];

  // exclude via doc tags
  exclude_tags: string[];

}

const config: Config = {
  root: '',
  index: '',
  package: '',
  drop_types: [],
  ...config_data,
};

const FlattenQualifiedName = (node: ts.QualifiedName): string[] => {

  const stack: string[] = [];

  if (ts.isIdentifier(node.left)) {
    stack.push(node.left.escapedText.toString());
  }
  else {
    stack.push(...FlattenQualifiedName(node.left));
  }

  stack.push(node.right.escapedText.toString());

  return stack;

};

const FlattenEntityName = (name: ts.EntityName, base?: string): string => {
  if (ts.isIdentifier(name)) {
    return name.escapedText.toString() + (base ? '.' + base : ''); 
  }
  base = name.right.escapedText.toString() + (base ? '.' + base : '');
  return FlattenEntityName(name.left, base);
};


interface ReadTypeArgs {
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

}

const GetDocTags = (node: ts.Node): string[] => {
  const tags = ts.getAllJSDocTags(node, (tag: ts.JSDocTag): tag is ts.JSDocTag => true);
  return tags.map(tag => {
    return tag.tagName.escapedText as string;
  });
}

/**
 * 
 * @param args 
 * @returns 
 */
function CleanTransformer<T extends ts.Node>(): ts.TransformerFactory<T> {

  /** 
   * flag indicates we're in an exported module. in this case, export is 
   * implicit so don't gate on that (otherwise we drop types that should be
   * included).
   */
  let exported_module = false;

  return context => {
    const visit: ts.Visitor = node => {

      const modifiers = (node.modifiers || []).map(member => {
        return ts.SyntaxKind[member.kind];
      });

      const tags = GetDocTags(node);
      const internal = 
        tags.some(test => config.exclude_tags.includes(test));

      const exported = modifiers.includes('ExportKeyword');
      const is_public = !(modifiers.includes('ProtectedKeyword') || modifiers.includes('PrivateKeyword'));

      if (ts.isModuleDeclaration(node)
          || ts.isClassDeclaration(node)
          || ts.isInterfaceDeclaration(node)
          || ts.isTypeAliasDeclaration(node)
          || ts.isEnumDeclaration(node)) {

        // FIXME: one of these declarations might be exported via
        // its module, and not independently; in that case we might
        // still need it.

        if ((!exported && !exported_module) || internal) {
          if (ts.isIdentifier(node.name)) {
            // console.info('dropping', node.name.escapedText.toString());
          }
          return undefined;
        }

        let name = '';

        if (ts.isIdentifier(node.name)) {
          name = node.name.escapedText.toString();
          // console.info('keeping', node.name.escapedText.toString());
        }

        if (ts.isModuleDeclaration(node)) {
          exported_module = true;
          const result = ts.visitEachChild(node, child => visit(child), context);
          exported_module = false;
          return result;
        }
        
        if (ts.isInterfaceDeclaration(node)) {

          // drop any internals

          const tmp = ts.factory.updateInterfaceDeclaration(node,
            node.decorators,
            node.modifiers,
            node.name,
            node.typeParameters,
            node.heritageClauses,
            node.members.filter(member => {

              const member_tags = GetDocTags(member);
              const internal = member_tags.some(test => config.exclude_tags.includes(test));

              if (internal) {
                return false;
              }

              return true;

          }));

          return ts.visitEachChild(tmp, child => visit(child), context);

        }

      }
      
      if (ts.isMethodDeclaration(node)
          || ts.isPropertyDeclaration(node)
          || ts.isAccessor(node)) {

        if (internal || !is_public) {
          return undefined;
        }

        if (ts.isMethodDeclaration(node)) {

          const tmp = ts.factory.updateMethodDeclaration(node,
            node.decorators, 
            node.modifiers,
            node.asteriskToken,
            node.name,
            node.questionToken,
            node.typeParameters,
            node.parameters.filter((test, index) => {
              if (ts.isTypeReferenceNode(test.type)) {
                if (ts.isIdentifier(test.type.typeName)) {
                  const name = test.type.typeName.escapedText.toString();
                  if (config.drop_types.includes(name)) {

                    // we want to drop it. it must be optional and
                    // at the end... (of course that won't work if 
                    // there are 2, but we don't have that problem atm).
                    
                    // you could solve that by reversing the array, then
                    // you would only ever drop from the end. remember
                    // to reverse it again before returning.

                    if (test.questionToken && index === node.parameters.length - 1) {
                      return false;                    
                    }

                  }
                }
              }
              return true;
            }).map(test => {
              if (ts.isTypeReferenceNode(test.type)) {
                if (ts.isIdentifier(test.type.typeName)) {
                  const name = test.type.typeName.escapedText.toString();
                  if (config.convert_to_any.includes(name)) {

                    // convert this type to any

                    return ts.factory.createParameterDeclaration(
                      test.decorators, 
                      test.modifiers, 
                      test.dotDotDotToken,
                      test.name, 
                      test.questionToken,
                      ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword),
                      // test.type, 
                      test.initializer
                    );

                  }
                }
              }
              return test;
            }),
            node.type,
            node.body);

          return ts.visitEachChild(tmp, child => visit(child), context);

        }
      }

      if (exported_module) {
        if (ts.isVariableStatement(node)) {

          const internal = tags.some(test => config.exclude_tags.includes(test));

          if (internal || !is_public) {
            return undefined;
          }
        }
      }

      return ts.visitEachChild(node, child => visit(child), context);
    }
    return node => ts.visitNode(node, visit);
  };

}

/**
 * collect all dependencies, recursively.
 * 
 * FIXME: namespacing
 * FIXME: collisions
 * 
 */
function CollectDependencyTransformer<T extends ts.Node>(
  args: ReadTypeArgs): ts.TransformerFactory<T> {

  let containing_type: string[] = [''];

  const AddFoundType = (name: string, text: string): boolean => {

    if (config.drop_types.includes(name) || config.convert_to_any.includes(name)) {
      return false; // aggressive
    }

    if (!args.types) {
      args.found_types[name] = text;
    }
    else {
      if (args.types.includes(name)) {
        args.found_types[name] = text;
        args.types = args.types.filter(test => test !== name);
      }
      else {
        args.extra_types[name] = text;
      }
    }

    return true;

  };

  const AddReferencedType = (name: string) => {

    // we're trying to block intrinsic types here but this will still
    // miss DOM types since they're not present in node... either we 
    // need a more robust mechanism or we should just not bother.

    const check = (global as any)[name];
    if (check) {
      return;
    }

    if (config.drop_types.includes(name) || config.convert_to_any.includes(name)) {
      return false; // aggressive
    }

    const container = containing_type[0];

    const list = args.referenced_type_map[container] || [];
    if (!list.includes(name)) { list.push(name); }
    args.referenced_type_map[container] = list;

    args.referenced_types[name] = (args.referenced_types[name]||0) + 1;
    return true;

  };

  return context => {
    const visit: ts.Visitor = node => {

      const modifiers = (node.modifiers || []).map(member => {
        return ts.SyntaxKind[member.kind];
      });

      const tags = GetDocTags(node);

      const internal = 
        tags.some(test => config.exclude_tags.includes(test));

      const exported = modifiers.includes('ExportKeyword');
      const is_public = !(modifiers.includes('ProtectedKeyword') || modifiers.includes('PrivateKeyword'));

      if (ts.isModuleDeclaration(node)
        || ts.isClassDeclaration(node)
        || ts.isInterfaceDeclaration(node)
        || ts.isTypeAliasDeclaration(node)
        || ts.isEnumDeclaration(node)) {

        if (exported && !internal) {

          if (ts.isIdentifier(node.name)) {
            if (!AddFoundType(node.name.escapedText.toString(), node.getFullText())) {
              return undefined;
            }

            containing_type.unshift(node.name.escapedText.toString());

            if (ts.isInterfaceDeclaration(node)) {

              // drop any internals, so we don't reference types
    
              node = ts.factory.updateInterfaceDeclaration(node,
                node.decorators,
                node.modifiers,
                node.name,
                node.typeParameters,
                node.heritageClauses,
                node.members.filter(member => {
    
                  const member_tags = GetDocTags(member);
                  const internal = member_tags.some(test => config.exclude_tags.includes(test));

                  if (internal) {
                    return false;
                  }
                  return true;
    
              }));

            }

            const result = ts.visitEachChild(node, child => visit(child), context);
            containing_type.shift();
            return result;

          }
          else {
            throw new Error('unhandled case (12)');
          }
        }
        else {
          return undefined; // do not recurse
        }

      }

      else if (ts.isExpressionWithTypeArguments(node)) {
        if (ts.isIdentifier(node.expression)) {
          const key = node.expression.escapedText.toString();
          AddReferencedType(key);
        }
        else if (ts.isQualifiedName(node.expression)) {
          const stack = FlattenQualifiedName(node.expression);
          if (stack.length) { 
            AddReferencedType(stack[0]);
          }
        }
      }

      else if (ts.isTypeReferenceNode(node)) {
        
        if (ts.isIdentifier(node.typeName)) {
          const key = node.typeName.escapedText.toString();
          AddReferencedType(key);
        }
        else if (ts.isQualifiedName(node.typeName)) {
          
          // do we want the qualified name, or just the thing we need
          // to import (right-most)?

          const stack = FlattenQualifiedName(node.typeName);
          // AddReferencedType(FlattenQualifiedName(node.typeName).join('.'));
          if (stack.length) { 
            AddReferencedType(stack[0]);
          }

        }
        else {
          throw new Error('unhandled case (13)');
        }
      }

      else if (ts.isPropertyDeclaration(node) 
               || ts.isMethodDeclaration(node)
               || ts.isAccessor(node)) {

        // FIXME: do we want static? in some cases, maybe yes...
        // we should probably filter later, and on a case-by-case basis

        // we're inside a method in a class... we should only get here
        // if the containing class was exported. here we are only looking
        // for types, and only on public methods. (same for properties;
        // must be public).

        if (ts.isIdentifier(node.name)) {
          if (!is_public || internal) {
            return undefined; // don't recurse
          }
        }
        else {
          throw new Error('unhandled case (15)');
        }
        
      }

      else if (ts.isImportDeclaration(node)) {

        let target = node.moduleSpecifier.getText();
        if (/^['"][\s\S]*?['"]$/.test(target)) {
          target = target.substr(1, target.length - 2);
        }

        if (node.importClause && ts.isImportClause(node.importClause)) {
          if (ts.isNamedImports(node.importClause.namedBindings)) {
            for (const element of node.importClause.namedBindings.elements) {
              const name = element.name.escapedText.toString();
              args.imported_types[name] = target;
            }
          }
        }

        return undefined;

      }
      else if (ts.isExportDeclaration(node)) {

          // this is export {A} from 'B', or export * from 'C'.

        if (node.moduleSpecifier) {
          let target = node.moduleSpecifier.getText();
          if (/^['"][\s\S]*?['"]$/.test(target)) {
            target = target.substr(1, target.length - 2);
          }

          const targets: string[] = args.recursive_targets[target] || [];

          if (node.exportClause && ts.isNamedExports(node.exportClause)) {
            for (const element of node.exportClause.elements) {
              const name = element.name.escapedText.toString();
              //if (args.types && args.types.includes(name)) {
              //  if (!args.recursive_targets[target]) { args.recursive_targets[target] = []; }
              //  args.recursive_targets[target].push(element.name.escapedText.toString());
              //}
              targets.push(name);
            }
          }
          else {
            // this is 'export * from SRC' type
            // if (!args.recursive_targets[target]) { args.recursive_targets[target] = []; }
            // args.recursive_targets[target].push(...args.types);
            targets.push('*');
          }

          args.recursive_targets[target] = targets;

        }

        return undefined;

      }

      return ts.visitEachChild(node, child => visit(child), context);
    }
    return node => ts.visitNode(node, visit);
  }
};

let invoke = 0;

const lookups: Record<string, boolean|string> = {};
const master: Record<string, string> = {};

const ReadTypes = async (file: string, types?: string[], origination = 'C', depth = 0, stack: string[] = []): Promise<ReadTypeArgs> => {

  if (stack.includes(file)) {
    console.info(file, stack);
    throw new Error('circular');
  }

  if (++invoke > 1e6) {
    console.info(file, stack);
    throw new Error('runaway');
  }

  // console.info("R", file, (types||[]).join(', '));

  /*
  if (types && types.includes('Sheet')) {
    console.info('want sheet', file, stack);
    throw new Error('want sheet');
  }
  */

  let depth_prefix = '';
  for (let i = 0; i < depth; i++) { depth_prefix += ' '; }

  const RelativeFilePath = (key: string): string => {
    if (key.startsWith('.')) {
      return path.join(config.root, path.dirname(file), key + '.d.ts');
    }
    else if (/\//.test(key)) {
      return path.join(config.root, key + '.d.ts');
    }
    else {
      return path.join(config.root, key, 'src', 'index.d.ts');
    }
  };

  // console.info("READ", depth_prefix, origination, file, types);

  const args: ReadTypeArgs = {
    types,
    recursive_targets: {},
    found_types: {},
    referenced_types: {},
    referenced_type_map: {},
    imported_types: {},
    extra_types: {},
  };

  const text = await fs.promises.readFile(file, { encoding: 'utf8' });
  const node = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);

  ts.transform(node, [CollectDependencyTransformer(args)]);

  let keys = Object.keys(args.referenced_types);
  const found = Object.keys(args.found_types);

  // console.info("T", (types||[]).join(', '))
  // console.info(' K1', keys.join(', '));

  // we can drop anything from keys that does not have a proper
  // containing type... although the containing type may _itself_
  // have a valid containing type... and so on...

  // what we should do is climb up the containing type list. note
  // that there could be more than one highest-level type...

  const containing_keys = Object.keys(args.referenced_type_map);
  const ResolveContainingTypes = (base: string, list: string[] = []) => {

    // find any types that contain this type
    for (const container of containing_keys) {
      if (args.referenced_type_map[container].includes(base)) {
        if (!list.includes(container)) {
          list.push(container);
          list.push(...ResolveContainingTypes(container, list));
        }
      }
    }
    return list;
  };

  if (types) {
    keys = keys.filter(key => {
      const list = ResolveContainingTypes(key);
      for (const entry of list) {
        if (types.includes(entry)) { return true; }
      }
      return false;
    });
  }

  // console.info(' KX', args.referenced_type_map);
  // console.info(' K2', keys.join(', '));
  // console.info(' F1', found.join(', '));

  // we may have referenced types from the same file, in which case we
  // need to add them to our "found" list.

  for (const extra of Object.keys(args.extra_types)) {
    if (keys.includes(extra) && !found.includes(extra)) {
      found.push(extra);
      args.found_types[extra] = args.extra_types[extra];
      lookups[`${file}:${extra}`] = true;
    }
  }

  // console.info(' F2', found.join(', '));

  const mapped: Record<string, string[]> = {};

  // if we were looking for a particular type in this file, did we 
  // find it? note that we're setting a boolean here, indicating simple
  // found or not found at this point.

  if (types) {
    for (const type of types) {
      lookups[`${file}:${type}`] = found.includes(type);
    }
  }

  // console.info(file);
  // console.info('want:', types ? types : 'all');
  // console.info('found:', found);
  // console.info('');

  const recursive = Object.keys(args.recursive_targets);

  if (recursive.length) {

    let filtered: string[] | undefined;
    if (types) {
      filtered = [];
      for (const type of types) {
        if (!found.includes(type)) {
          filtered.push(type);
        }
      }
    }

    if (!filtered || filtered.length) {
      for (const key of recursive) {
        const file_path = RelativeFilePath(key);
        let sublist = args.recursive_targets[key];
        let result: ReadTypeArgs;

        if (sublist.includes('*')) {
          sublist = filtered;
        }
        else {
          sublist = sublist.filter(test => filtered.includes(test));
        }

        // NOW filter on whether we've checked this path for this 
        // type before. if so, even if we missed, we can drop it.

        sublist = sublist.filter(test => {
          const composite = `${file_path}:${test}`;
          const check = lookups[composite];
          return typeof check === 'undefined';
        });

        if (sublist.length) {
          result = await ReadTypes(file_path, sublist, 'X', depth + 1, [...stack, file]);
          const resolved = Object.keys(result.found_types);

          // if we found a type in a child that we were looking for, we can
          // point our record (which should be false) to the child record

          // UPDATE: this changes a bit when we have "extra" types, which 
          // were not originally referenced... in that case our record could
          // be undefined, or even a string...

          for (const test of resolved) {
            const ours = `${file}:${test}`;
            const theirs = `${file_path}:${test}`;
            // console.info("CHECK 1", ours, master[ours], theirs, master[theirs]);

            // validate
            if (/*(lookups[ours] === false || lookups[ours] === undefined) &&*/ lookups[theirs] === true) {
              lookups[ours] = theirs;
            }
            else {
              console.info("CHECK 1", ours, lookups[ours], theirs, lookups[theirs]);
              console.info("F", file);
              throw new Error('??');
            }

          }

          filtered = filtered.filter(test => !resolved.includes(test));
          if (!filtered.length) { break; }
        }

      }

    }
  }
  
  for (const key of keys) {
    if (!found.includes(key) && args.imported_types[key]) {
      const source = args.imported_types[key];
      const list = mapped[source] || [];
      mapped[source] = [...list, key];
    }
  }

  for (const key of found) {
    master[key] = args.found_types[key];
  }

  // console.info(file, Object.keys(mapped).join(', '));

  /*
  if (!types) {
    console.info("I AM TOP")
    console.info(mapped);
  }
  */

  for (const key of Object.keys(mapped)) {

    let list = mapped[key];
    const file_path = RelativeFilePath(key);

    // filter types we've already read from this file
    list = list.filter(test => {
      const composite = `${file_path}:${test}`;
      const check = lookups[composite];
      return typeof check === 'undefined';
    });

    if (list.length) {
      await ReadTypes(file_path, list, 'I', depth + 1, [...stack, file]);
    }

    // if (2>1) throw new Error('ending after 1st import')

  }

  return args;
  
};

const Run = async () => {

  // read index file

  const index = path.join(config.root, config.index);

  await ReadTypes(index);

  console.info(`(done, ${invoke})`);

  const text: string[] = [];
  for (const key of Object.keys(master)) {
    // if (!config.drop_types.includes(key)) {
      text.push(master[key]);
    //}
  }

  const composite = text.join('\n');
  const node = ts.createSourceFile('composite', composite, ts.ScriptTarget.Latest, true);
  const result = ts.transform(node, [CleanTransformer()])

  const printer = ts.createPrinter();
  let printed = printer.printFile(result.transformed[0]); // FIXME: options

  // TS doesn't really like spaces
  printed = printed.replace(/(\s+?\/\*)/g, '\n$1');

  if (config.output) {
    await fs.promises.writeFile(config.output, printed, {encoding: 'utf8'});
  }
  else {
    console.info(printed);
  }


  /*
  const text = await fs.promises.readFile(index, { encoding: 'utf8' });
  const node = ts.createSourceFile(index, text, ts.ScriptTarget.Latest, true);

  const args = {
    recursive_targets: {},
    found_types: {},
    referenced_types: {},
    imported_types: {},
  };

  const result = ts.transform(node, [CollectDependencyTransformer(args)]);

  // console.info(Object.keys(args.found_types));
  // console.info(args.referenced_types);

  const keys = Object.keys(args.referenced_types);
  keys.sort();

  const found = Object.keys(args.found_types);
  const mapped: Record<string, string[]> = {};

  for (const key of keys) {
    if (found.includes(key)) { 
      // console.info(`${key} => FOUND`);
    }
    else if (args.imported_types[key]) {
      const source = args.imported_types[key];
      // console.info(`${key} => ${args.imported_types[key]}`);
      const list = mapped[source] || [];
      mapped[source] = [...list, key];
    }
    else {
      console.info(`${key} => missing!`);
    }
  }
  console.info('---');
  console.info(mapped);
  */


};

Run();

