
import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

import type { Config, ReadTypeArgs } from './api-generator-types';

let config_file = './api-config.json';
for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === '-c' || process.argv[i] === '--config') {
    config_file = process.argv[++i];
  }
}

// all files should be relative to the config file.
const config_dir = path.dirname(config_file);

let config: Config = {
  root: '',
  index: '',
  package: '',
  drop_types: [],
  convert_to_any: [],
  exclude_tags: [],
  rename_types: {},
  drop_generics: [],
  map: {},
  include: [],
  flatten_enums: false,
};

let api_version = '';

const ReadConfigData = async (file: string) => {

  const text = await fs.promises.readFile(file, {encoding: 'utf8'});
  const obj = JSON.parse(text);
  config = {
    ...config,
    ...obj,
  };

  if (config.package) {
    const pkg = await fs.promises.readFile(path.join(config_dir, config.package), {encoding: 'utf8'});
    const data = JSON.parse(pkg);
    api_version = data.version.replace(/\.\d+$/, '');
    console.info('v', api_version);
  }

};

///

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

/*
const FlattenEntityName = (name: ts.EntityName, base?: string): string => {
  if (ts.isIdentifier(name)) {
    return name.escapedText.toString() + (base ? '.' + base : ''); 
  }
  base = name.right.escapedText.toString() + (base ? '.' + base : '');
  return FlattenEntityName(name.left, base);
};
*/

const GetDocTags = (node: ts.Node): string[] => {
  const tags = ts.getAllJSDocTags(node, (tag: ts.JSDocTag): tag is ts.JSDocTag => true);
  return tags.map(tag => {
    return tag.tagName.escapedText as string;
  });
}

/**
 * when adding fake (synthetic) comments, the printer will add multiline
 * comment markers \/* *\/. we need to remove them.
 * @param text 
 */
function CleanComment(text: string): string {

  if (/^\/\*/.test(text)) {
    text = text.substring(2);
  }
  if (/\*\/$/.test(text)) {
    text = text.substring(0, text.length - 2);
  }

  return text;
}

/**
 * 
 * @param args 
 * @returns 
 */
function CleanTransformer<T extends ts.Node>(): ts.TransformerFactory<T> {

  const rename_keys = Object.keys(config.rename_types);

  /** 
   * flag indicates we're in an exported module. in this case, export is 
   * implicit so don't gate on that (otherwise we drop types that should be
   * included).
   */
  let exported_module = false;

  return (context: ts.TransformationContext) => {

    const visit: ts.Visitor = (node: ts.Node): ts.Node|undefined => {

      // FIXME: not sure what this was before

      const modifiers = ((node as any).modifiers || []).map(member => {
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
          if (node.name && ts.isIdentifier(node.name)) {
            // console.info('dropping', node.name.escapedText.toString());
          }
          return undefined;
        }

        let name = '';

        if (node.name && ts.isIdentifier(node.name)) {
          name = node.name.escapedText.toString();
          // console.info('keeping', node.name.escapedText.toString());
        }

        if (ts.isModuleDeclaration(node)) {
          exported_module = true;
          const result = ts.visitEachChild(node, child => visit(child), context);
          exported_module = false;
          return result;
        }
                
        if (ts.isClassDeclaration(node)) {
          if (config.drop_generics.includes(name)) {
            
            const tmp = ts.factory.updateClassDeclaration(node, 
              // node.decorators,
              node.modifiers,
              node.name,
              [], // node.typeParameters,
              node.heritageClauses,
              node.members);

              return ts.visitEachChild(tmp, child => visit(child), context);
              
          }
        }

        if (ts.isEnumDeclaration(node)) {
          if (config.flatten_enums) {

            const alias = ts.factory.createTypeAliasDeclaration(
              // node.decorators,
              node.modifiers,
              node.name,
              [], 
              ts.factory.createUnionTypeNode(
                node.members.map((member, i) => {

                  if (member.initializer) {

                    if (ts.isNumericLiteral(member.initializer)
                        || ts.isStringLiteral(member.initializer)) {
                      return ts.factory.createLiteralTypeNode(member.initializer);
                    }
                  }

                  // this may be wrong if there are some initializers [FIXME].
                  // what happens if you say 
                  // 
                  // enum X = { A, B = 3, C }
                  // 
                  // it's probably something like resetting the automatic counter,
                  // which we could do. need to investigate though.

                  return ts.factory.createLiteralTypeNode(ts.factory.createNumericLiteral(i));

                })
              ));

            if ((node as any).jsDoc && (node as any).jsDoc[0]) {

              const source_text = node.getSourceFile().text;
              const jsDoc: ts.JSDoc[] = (node as any).jsDoc;
              const comment = CleanComment(source_text.substring(jsDoc[0].pos, jsDoc[0].end));

              ts.addSyntheticLeadingComment(alias, ts.SyntaxKind.MultiLineCommentTrivia, comment);

            }

            return ts.visitEachChild(alias, child => visit(child), context);
          }

        }

        if (ts.isInterfaceDeclaration(node)) {

          // drop any internals

          const tmp = ts.factory.updateInterfaceDeclaration(node,
            // node.decorators,
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

      if (ts.isIdentifier(node)) {
        const name = node.escapedText.toString();
        if (rename_keys.includes(name)) {
          // console.info( ' ** ', name);
          return ts.factory.createIdentifier(config.rename_types[name]);
        }
      }

      if (ts.isMethodDeclaration(node)
          || ts.isConstructorDeclaration(node)
          || ts.isPropertyDeclaration(node)
          || ts.isAccessor(node)) {

        if (internal || !is_public) {
          return undefined;
        }

        // FIXME: fix ctor parameters like method parameters

        if (ts.isMethodDeclaration(node)) {

          // UPDATE: convert to any -> handle return type 

          let return_type = node.type;
          if (return_type && ts.isTypeReferenceNode(return_type)) {
            if (ts.isIdentifier(return_type.typeName)) {
              const name = return_type.typeName.escapedText.toString();
              if (config.convert_to_any.includes(name)) {
                return_type = ts.factory.createKeywordTypeNode(ts.SyntaxKind.AnyKeyword);
              }
            }
          }

          const tmp = ts.factory.updateMethodDeclaration(node,
            // node.decorators, 
            node.modifiers,
            node.asteriskToken,
            node.name,
            node.questionToken,
            node.typeParameters,
            node.parameters.filter((test, index) => {
              if (test.type && ts.isTypeReferenceNode(test.type)) {
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
              if (test.type && ts.isTypeReferenceNode(test.type)) {
                if (ts.isIdentifier(test.type.typeName)) {
                  const name = test.type.typeName.escapedText.toString();
                  if (config.convert_to_any.includes(name)) {

                    // convert this type to any

                    return ts.factory.createParameterDeclaration(
                      // test.decorators, 
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
            return_type, // node.type,
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
    };

    return (node: T) => ts.visitEachChild(node, visit, context);    

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

  const containing_type: string[] = [''];

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

  const AddReferencedType = (name: string, track: number) => {

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
    if (!list.includes(name)) { 
      list.push(name); 
    }
    args.referenced_type_map[container] = list;

    args.referenced_types[name] = (args.referenced_types[name]||0) + 1;
    return true;

  };

  return (context: ts.TransformationContext) => {

    const visitor: ts.Visitor = (node: ts.Node) => {
      return node;
    }

    const visit: ts.Visitor = (node: ts.Node) => {

      const modifiers = ts.canHaveModifiers(node) ? (ts.getModifiers(node) || []).map(member => {
        return ts.SyntaxKind[member.kind];
      }) : [];

      const tags = GetDocTags(node);

      const internal = 
        tags.some(test => config.exclude_tags.includes(test));

      const exported = modifiers.includes('ExportKeyword');
      const declared = modifiers.includes('DeclareKeyword');
      const is_public = !(modifiers.includes('ProtectedKeyword') || modifiers.includes('PrivateKeyword'));

      if (ts.isModuleDeclaration(node)
        || ts.isClassDeclaration(node)
        || ts.isInterfaceDeclaration(node)
        || ts.isTypeAliasDeclaration(node)
        || ts.isEnumDeclaration(node)) {

        if (exported && !internal) {

          if (node.name && ts.isIdentifier(node.name)) {

            if (!AddFoundType(node.name.escapedText.toString(), node.getFullText())) {
              return undefined;
            }

            containing_type.unshift(node.name.escapedText.toString());

            if (ts.isClassDeclaration(node)) {
              const name = node.name?.escapedText;
              if (name && config.drop_generics.includes(name)) {
                node = ts.factory.updateClassDeclaration(node, 
                  // node.decorators,
                  node.modifiers,
                  node.name,
                  [], // node.typeParameters,
                  node.heritageClauses,
                  node.members);
              }
            }

            if (ts.isInterfaceDeclaration(node)) {

              // drop any internals, so we don't reference types
    
              node = ts.factory.updateInterfaceDeclaration(node,
                // node.decorators,
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

      else if (ts.isVariableStatement(node)) {
        if (exported && !internal) {

          // the type will be found, so we don't have to worry about that.
          // should we be concerned with invalid/removed types? (...)

          // we may see this more than once, if a file is included by 
          // other files. is there a better way to identify variables?
          // maybe we should affirmatively declare exports with a tag

          const text = node.getFullText();
          args.exported_variables.push(text);

        }
        else {
          return undefined; // end
        }
      }

      else if (ts.isExpressionWithTypeArguments(node)) {
        if (ts.isIdentifier(node.expression)) {
          const key = node.expression.escapedText.toString();
          AddReferencedType(key, 0);
        }
        else if (ts.isQualifiedName(node.expression)) {
          const stack = FlattenQualifiedName(node.expression);
          if (stack.length) { 
            AddReferencedType(stack[0], 1);
          }
        }
      }

      else if (ts.isTypeReferenceNode(node)) {
        
        if (ts.isIdentifier(node.typeName)) {
          const key = node.typeName.escapedText.toString();
          AddReferencedType(key, 2);
        }
        else if (ts.isQualifiedName(node.typeName)) {
          
          // do we want the qualified name, or just the thing we need
          // to import (right-most)?

          const stack = FlattenQualifiedName(node.typeName);
          // AddReferencedType(FlattenQualifiedName(node.typeName).join('.'));
          if (stack.length) { 
            AddReferencedType(stack[0], 3);
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

      else if (ts.isConstructorDeclaration(node)) {

        if (!is_public || internal) {
          return undefined; // don't recurse
        }
        else {
          // console.info(node);
          // console.info('public?', is_public, 'tags?', tags);
          // throw new Error('no');
        }
      }

      else if (ts.isImportDeclaration(node)) {

        let target = node.moduleSpecifier.getText();
        if (/^['"][\s\S]*?['"]$/.test(target)) {
          target = target.substr(1, target.length - 2);
        }

        if (node.importClause && ts.isImportClause(node.importClause)) {
          if (node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
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
              AddReferencedType(name, 4);
            }
          }
          else {
            // this is 'export * from SRC' type
            // if (!args.recursive_targets[target]) { args.recursive_targets[target] = []; }
            // args.recursive_targets[target].push(...args.types);
            targets.push('*');
          }

          // console.info(targets);

          args.recursive_targets[target] = targets;

        }

        return undefined;

      }

      return ts.visitEachChild(node, visit, context);
    };

    return node => ts.visitEachChild(node, visit, context);


  }
}

let invoke = 0;

const lookups: Record<string, boolean|string> = {};
const master: Record<string, string> = {};
const exported_variables: string[] = [];

let var_index = 0;

const ReadTypes = async (file: string, types?: string[], origination = 'C', depth = 0, stack: string[] = []): Promise<ReadTypeArgs> => {

  // console.info('read types:', file, types);

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
    for (const prefix of Object.keys(config.map)) {
      if (key.startsWith(prefix)) { // should === ?
        const replaced = key.replace(prefix, config.map[prefix]);
        return path.join(config_dir, replaced);
      }
    }

    if (key.startsWith('.')) {
      return path.join(path.dirname(file), key + '.d.ts');
    }
    else if (/\//.test(key)) {
      return path.join(config_dir, config.root, key + '.d.ts');
    }
    else {
      return path.join(config_dir, config.root, key, 'src', 'index.d.ts');
      // return path.join(config_dir, config.root, key, 'src', 'index.d.ts');
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
    exported_variables: [],
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

  //============================================================================
  // Q: what is this for? it's broken. temporarily removing.
  //============================================================================

  const containing_keys = Object.keys(args.referenced_type_map);

  /*
  {
    fs.writeFileSync('check.json', JSON.stringify(args.referenced_type_map, undefined, 2), {encoding: 'utf8'});
  }
  */

  const ResolveContainingTypes = (base: string, list: string[] = [], depth = 0) => {
    // find any types that contain this type

    /*
    let s = '';
    for (let i = 0; i< depth; i++) s += ' ';
    console.info(s, 'rct', base, '');
    */

    for (const container of containing_keys) {
      if (args.referenced_type_map[container].includes(base)) {
        if (!list.includes(container)) {
          // console.info(s, '   check [2]', container);
          list.push(container);
          //const sublist = ResolveContainingTypes(container, list, depth + 1);
          ResolveContainingTypes(container, list, depth + 1);

          // list.push(...sublist);
        }
      }
    }
    return list;
  }

  /**
  const ResolveContainingTypes = (base: string, list: string[] = []) => {

    // find any types that contain this type
    for (const container of containing_keys) {
      if (args.referenced_type_map[container].includes(base)) {
        if (!list.includes(container)) {
          list.push(container);
          const sublist = ResolveContainingTypes(container, list);
          list.push(...sublist);
        }
      }
    }
    return list;
  };
  */

  // console.info('\n');

  if (types) {
    keys = keys.filter(key => {
      const list = ResolveContainingTypes(key);
      for (const entry of list) {
        if (types.includes(entry)) { return true; }
      }
      // console.info("DROPPING", key);
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

  /*
  console.info('file:', file);
  console.info('want:', types ? types : 'all');
  console.info('found:', found);
  console.info('recursive:', args.recursive_targets);
  console.info('');
  */

  const recursive = Object.keys(args.recursive_targets);
  // console.info({recursive});

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

    // console.info({types, found, filtered});

    if (!filtered || filtered.length) {
      for (const key of recursive) {
        const file_path = RelativeFilePath(key);

        let sublist: string[] | undefined = args.recursive_targets[key];
        let result: ReadTypeArgs;

        // console.info(0, {file_path, key, sublist, filtered});

        if (sublist.includes('*')) {
          sublist = filtered;
        }
        else if (filtered) {
          // console.info({sublist, filtered})
          sublist = sublist.filter(test => (filtered||[]).includes(test));
        }
        else {
          // console.info("using sublist without filter:", sublist);
        }

        // console.info(1, {file_path, key, sublist});

        // NOW filter on whether we've checked this path for this 
        // type before. if so, even if we missed, we can drop it.

        sublist = (sublist||[]).filter(test => {
          const composite = `${file_path}:${test}`;
          const check = lookups[composite];
          return typeof check === 'undefined';
        });

        // console.info(2, {sublist});

        if (sublist.length) {
          result = await ReadTypes(file_path, sublist, 'X', depth + 1, [...stack, file]);
          const resolved = Object.keys(result.found_types);

          // console.info({resolved});

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
              // console.info("CHECK 1", ours, lookups[ours], theirs, lookups[theirs]);
              // console.info("F", file);
              throw new Error('??');
            }

          }

          if (filtered) {
            filtered = (filtered || []).filter(test => !resolved.includes(test));
            if (!filtered.length) { break; }
          }
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

  for (const statement of args.exported_variables) {
    if (!exported_variables.includes(statement)) {
      master[`__variable_${var_index++}`] = statement;
      // console.info(statement);
      exported_variables.push(statement);
    }
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

  // console.info("ARGS", args, '\n');

  return args;
  
};

const Run = async () => {

  await ReadConfigData(config_file);
  console.info(config);

  // read index file
  const index = path.join(config_dir, config.root, config.index);

  await ReadTypes(index);

  // console.info(`(done, ${invoke})`);

  const text: string[] = [];
  for (const key of Object.keys(master)) {
    text.push(master[key]);
  }

  const composite = text.join('\n');
  const node = ts.createSourceFile('composite', composite, ts.ScriptTarget.Latest, true);
  const result = ts.transform(node, [CleanTransformer()])

  const printer = ts.createPrinter();
  let printed = printer.printFile(result.transformed[0]); // FIXME: options

  // TS doesn't really like spaces
  printed = printed.replace(/(\s+?\/\*)/g, '\n$1');

  // prepend any include files
  for (let include of config.include) {
    include = path.join(config_dir, include);
    const text = await fs.promises.readFile(include, {encoding: 'utf8'});
    printed = text + printed;
  }

  if (api_version) {
    const banner = `/*! API v${api_version}. Copyright 2018-${new Date().getFullYear()} trebco, llc. All rights reserved. LGPL: https://treb.app/license */`;
    printed = banner + '\n' + printed;
  }

  // can't figure out how to transform jsdoc nodes using transformers.
  // so, back to hacks. the aim here is to remove @privateRemarks, up
  // to the next tag (@) or close comment (*/). this often results in 
  // an extra empty line in the comment, which is unfortunate but not
  // the end of the world.

  printed = printed.replace(/(\s*\*)\s*@privateRemarks[\s\S]*?((?: @|\*\/))/g, '$1$2');

  // 
  // attempting to clean up... this somewhat confusing regexp
  // is intended to convert
  //
  // /**
  //  * build version
  //  *
  //  **/
  // version: string;
  //
  // (caused by removing @privateRemarks) to
  //
  // /**
  //  * build version
  //  */
  // version: string;
  //
  printed = printed.replace(/(\*\n[ ]+)\*\*\//g, '*/')

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


