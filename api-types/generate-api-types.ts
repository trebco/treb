
/**
 * scrub declaration file -- remove nonpublic elements or anything
 * with an @internal tsdoc tag. also remove @privateRemarks.
 * 
 * this is somewhat specific to our use case for our API, it's intended
 * to run on treb-embed/src/embedded-spreadsheet-base.d.ts.
 * 
 * we will have to add some missing types, presumably as interfaces,
 * plus do a little additional scrubbing that I didn't want to hardcode
 * into this file.
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';
import { config } from './api-config';

// console.info("CFG", config);

let pkg: string = config.package;
let base: string = config.base;
let output_file: string = config.output;
const cats: string[] = config.cat;

for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === '--base') {
    base = process.argv[++i];
  }
  else if (process.argv[i] === '--output') {
    output_file = process.argv[++i];
  }
  else if (process.argv[i] === '--cat') {
    cats.push(process.argv[++i]);
  }
  else if (process.argv[i] === '--package') {
    pkg = process.argv[++i];
  }
}

const Banner = async () => {

  const text = await fs.promises.readFile(pkg, {encoding: 'utf8'});
  const obj = JSON.parse(text);

  // version is semantic so major.minor.patch. for the API we want
  // to drop patch.

  const version = obj.version.replace(/\.\d+$/, '');

  console.info("API version", version);

  // TODO: generate banner, return it

  // from compile2:
  const banner = `/*! API v${version}. Copyright 2018-${new Date().getFullYear()} Structured Data, LLC. All rights reserved. CC BY-ND: https://treb.app/license */`;
  return banner;

}

const GetDocTags = (node: ts.Node): string[] => {
  const tags = ts.getAllJSDocTags(node, (tag: ts.JSDocTag): tag is ts.JSDocTag => true);
  return tags.map(tag => {
    return tag.tagName.escapedText as string;
  });
}

const InterfaceMembers = (node: ts.InterfaceDeclaration) => {
  return node.members.filter(member => {
    const tags = GetDocTags(member);
    if (tags.includes('internal')) {
      return false;
    }    
    return true;
  });
}

const ClassMembers = (node: ts.ClassDeclaration) => {

  /*
  return node.members.filter(member => {

    const modifiers = (member.modifiers || []).map(member => {
      return ts.SyntaxKind[member.kind];
    });

    // drop non-public and static

    if (modifiers.includes('ProtectedKeyword')
        || modifiers.includes('PrivateKeyword')
        || modifiers.includes('StaticKeyword')) {
      return false;
    }

    const tags = GetDocTags(member);

    // drop @internal

    if (tags.includes('internal')) {
      return false;
    }

    return true;

  });
  */
 return node.members;

};

const TrimLines = (text: string) => {
  return text.split('\n').filter(line => !!line.trim()).join('\n');
}

const Scrub = (text: string) => {

  if (/@privateRemarks/.test(text)) {

    const lines = text.split(/\n/);
    const scrubbed: string[] = [];
    let i = 0;

    for (i = 0; i < lines.length; i++) {
      if (/@privateRemarks/.test(lines[i])) {
        break;
      }
      scrubbed.push(lines[i]);
    }
    for (++i; i < lines.length; i++) {
      if (/^\s*\*\s*@/.test(lines[i])
          || /(?:^|\s)\*\//.test(lines[i])) {
        break;
      }
    }
    for (; i < lines.length; i++) {
      scrubbed.push(lines[i]);
    }

    text = scrubbed.join('\n');
  }

  return TrimLines(text);

}

const referened_type_list: Record<string, number> = {};
const declared_type_list: Record<string, number> = {};
const import_target_list: Record<string, string> = {};

const AddReferencedType = (name: string) => {

  // check ambient

  if (!!(global as any)[name]) {
    // console.info(' (ambient)');
  }
  else {
    referened_type_list[name] = (referened_type_list[name] || 0) + 1;
  }
}

function CollectDependencyTransformer<T extends ts.Node>(
      target: string, 
      types: string[],
      followup: Record<string, string[]>,
      found_types: Record<string, string>,
      ): ts.TransformerFactory<T> {

  return context => {

    const visit: ts.Visitor = node => {

      const modifiers = (node.modifiers || []).map(member => {
        return ts.SyntaxKind[member.kind];
      });

      const exported = modifiers.includes('ExportKeyword');

      /*
      if (/style/i.test(target)) {
        console.info("N", ts.SyntaxKind[node.kind]);
      }
      */

      if (ts.isModuleDeclaration(node)) {
        if (exported) {
          if (ts.isIdentifier(node.name)) {
            const name = node.name.escapedText.toString();
            if (types.includes(name)) {
              found_types[name] = node.getFullText();
              types = types.filter(test => test !== name);
            }
          }
        }

        // FIXME: we need to scrub inside the module, and rewrite (print)

        return undefined;
      }

      if ((ts.isInterfaceDeclaration(node) 
           || ts.isTypeAliasDeclaration(node)
           || ts.isEnumDeclaration(node))) {
        if (exported) {
          const name = node.name.escapedText.toString();
          if (types.includes(name)) {
            found_types[name] = node.getFullText();
            types = types.filter(test => test !== name);
          }        
        }
        return undefined; // short-circuit
      }

      if (ts.isExportDeclaration(node)) {

        if (node.moduleSpecifier) {
          let target = node.moduleSpecifier.getText();
          if (/^['"][\s\S]*?['"]$/.test(target)) {
            target = target.substr(1, target.length - 2);
          }

          if (node.exportClause && ts.isNamedExports(node.exportClause)) {
            for (const element of node.exportClause.elements) {
              const name = element.name.escapedText.toString();
              if (types.includes(name)) {
                if (!followup[target]) { followup[target] = []; }
                followup[target].push(element.name.escapedText.toString());
              }
            }
          }
          else {
            // this is 'export * from SRC' type
            if (!followup[target]) { followup[target] = []; }
            followup[target].push(...types);
          }
        }
      }

      return ts.visitEachChild(node, child => visit(child), context);
    }
    return node => ts.visitNode(node, visit);
  }
};

/**
 * look for the named types in the target file (we may have to do some
 * digging), collect them along with any dependencies. this may recurse
 * so it's not necessarily a problem if we don't find them all... ?
 * 
 * @param types 
 * @param target 
 */
 const CollectTypes = async (target: string, types: string[]): Promise<Record<string, string>> => {

  // console.info("\nCT", target);
  const results: Record<string, string> = {};

  const text = await fs.promises.readFile(target, {encoding: 'utf8'});
  const node = ts.createSourceFile(base, text, ts.ScriptTarget.Latest, true);

  const followup: Record <string, string[]> = {};
  const found_types: Record <string, string> = {};

  const result = ts.transform(node, [CollectDependencyTransformer(target, types, followup, found_types)]);
  
  for (const key of Object.keys(found_types)) {
    results[key] = found_types[key];
  }

  for (const key of Object.keys(followup)) {
    const list = followup[key];
    // console.info("FU", key, list.join(', '));
    
    let fu = path.resolve(path.dirname(target), key);
    fu = path.dirname(fu) + path.sep + path.basename(key) + '.d.ts';
    // console.info("?", fu);
    const subset = await CollectTypes(fu, list);
    for (const key of Object.keys(subset)) {
      results[key] = subset[key];
    }
    // console.info('\n');
  }

  return results;

};


function transformer<T extends ts.Node>(): ts.TransformerFactory<T> {

  let verbose = false;

  return context => {
    const visit: ts.Visitor = node => {

      if (ts.isImportDeclaration(node)) {
        
        let target = node.moduleSpecifier.getText();
        if (/^['"][\s\S]*?['"]$/.test(target)) {
          target = target.substr(1, target.length - 2);
        }

        // const list: string[] = [];

        if (node.importClause && ts.isImportClause(node.importClause)) {
          if (ts.isNamedImports(node.importClause.namedBindings)) {
            for (const element of node.importClause.namedBindings.elements) {
              // list.push(element.name.escapedText.toString());
              const name = element.name.escapedText.toString();
              import_target_list[name] = target;
            }
          }
        }

        // console.info("L", list.join(', '));
        // console.info("MS", node.moduleSpecifier.getText());
        // console.info(node.getText(node.getSourceFile()), '\n');
        // throw new Error('1');
      }

      const modifiers = (node.modifiers || []).map(member => {
        return ts.SyntaxKind[member.kind];
      });

      // drop private, protected, static

      if (modifiers.includes('PrivateKeyword')
          || modifiers.includes('ProtectedKeyword')
          || modifiers.includes('StaticKeyword')) {
        return undefined;
      }

      // drop @internal

      const tags = GetDocTags(node);
      if (tags.includes('internal')) {
        return undefined;
      }

      // drop enum/class/interface that is not exported
      // FIXME: type?

      if (verbose) {
        console.info("T", ts.SyntaxKind[node.kind]);
      }

      if (ts.isInterfaceDeclaration(node) 
          || ts.isEnumDeclaration(node) 
          || ts.isClassDeclaration(node)
          || ts.isTypeAliasDeclaration(node)) {

        if (!modifiers.includes('ExportKeyword')) {
          return undefined;
        }
        if (ts.isIdentifier(node.name)) {
          const name = node.name.escapedText.toString();
          declared_type_list[name] = (declared_type_list[name] || 0) + 1;
        }
      }

      if (ts.isTypeReferenceNode(node)) {
        
        if (ts.isIdentifier(node.typeName)) {
          const key = node.typeName.escapedText.toString();
          AddReferencedType(key);
        }
        else if (ts.isQualifiedName(node.typeName)) {
          if (ts.isIdentifier(node.typeName.left)) {
            AddReferencedType(node.typeName.left.escapedText.toString());
          }
          else {
            console.info(" * [missing branch, 1]");
          }
        }
        else {
          console.info(" * [missing branch, 2]");
        }
      }

      
      if (ts.isExpressionWithTypeArguments(node)) {

        // console.info("EWTA", node.getText());
        // console.info("NE type", ts.SyntaxKind[node.expression.kind]);

        if (ts.isIdentifier(node.expression)) {
          const key = node.expression.escapedText.toString();
          AddReferencedType(key);
        }

        /*
        // console.info(node, '\n');
        verbose = true;
        const result = ts.visitEachChild(node, child => visit(child), context);
        verbose = false;
        return result;
        */
      }
      

      if (ts.isClassDeclaration(node)) {
        if (ts.isIdentifier(node.name)) {
          const name = node.name.escapedText.toString();
          const match = config.rename_classes[name];
          if (match) {
            const tmp = ts.factory.createClassDeclaration(
              node.decorators,
              node.modifiers,
              ts.factory.createIdentifier(match),
              node.typeParameters,
              node.heritageClauses,
              node.members,
            );
            declared_type_list[match] = (declared_type_list[match] || 0) + 1;
            // verbose = true;
            const result = ts.visitEachChild(tmp, child => visit(child), context);
            // verbose = false;
            return result;
          }
          else {
            declared_type_list[name] = (declared_type_list[name] || 0) + 1;
          }
        }

        /*
        verbose = true;
        const result = ts.visitEachChild(node, child => visit(child), context);
        verbose = false;
        return result;
        */

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

        /*
        verbose = true;
        if (ts.isIdentifier(node.name)) {
          console.info('func:', node.name.escapedText);
        }
        else {
          console.info('func: (unnamed)');
        }
        const result = ts.visitEachChild(node, child => visit(child), context);
        verbose = false;
        console.info('');
        return result;
        */
      }

      return ts.visitEachChild(node, child => visit(child), context);

      // return ts.visitEachChild(node, child => visit(child), context);
      
      /*
      if (ts.isNumericLiteral(node)) {
        return ts.createStringLiteral(node.text);
      }
      */
    };

    return node => ts.visitNode(node, visit);
  };
}

const Run = async (): Promise<void> => {

  const output: string[] = [];

  let text = await fs.promises.readFile(base, {encoding: 'utf8'});
  const original = ts.createSourceFile(base, text, ts.ScriptTarget.Latest, true);
  const result = ts.transform(original, [transformer()]);

  // const node = result.transformed[0];

  const printer = ts.createPrinter();
  text = printer.printFile(result.transformed[0]); // FIXME: options

  const node = ts.createSourceFile(base, text, ts.ScriptTarget.Latest, true);

  // console.info(node);

  // simple: dump node
  const NodeText = (child: ts.Node) => Scrub(text.substring(child.pos, child.end));

  node.forEachChild(child => {

    const modifiers = (child.modifiers || []).map(member => {
      return ts.SyntaxKind[member.kind];
    });

    // only look at exported class/interface/enum/type

    //if (!modifiers.includes('ExportKeyword')) {
    //  return;
    //}

    // check for @internal

    /*
    const tags = GetDocTags(child);
    if (tags.includes('internal')) {
      return;
    }
    */

    switch (child.kind) {
      case ts.SyntaxKind.InterfaceDeclaration:
        if (ts.isInterfaceDeclaration(child)) {
          const text = NodeText(child);
          const parts = text.match(/(^[\s\S]*?{)/);

          if (parts) { 
            output.push(parts[1] + '\n'); 
            for (const member of InterfaceMembers(child)) {
              output.push(NodeText(member) + '\n');
            }
            output.push('}\n');
          }
        }
        break;

      case ts.SyntaxKind.TypeAliasDeclaration:
      case ts.SyntaxKind.EnumDeclaration:
        output.push(NodeText(child) + '\n');
        break;

      case ts.SyntaxKind.ClassDeclaration:

        if (ts.isClassDeclaration(child)) {


          let name = '';

          if (child.name && ts.isIdentifier(child.name)) {
            name = child.name.escapedText as string;
          }
          else {
            throw new Error('invalid class identifier');
          }

          // is this always going to work? (...)
          // console.info(child.getText().split(/\n/)[0]);
          const def = child.getText().match(/^([\s\S]*?{)/);
          if (def) {
            // console.info(def[1]);
            output.push(def[1] + '\n');
          }
          else {
            // this is a hack
            
            output.push(`export declare class ${name} {\n`);
          }

          for (const member of ClassMembers(child as ts.ClassDeclaration)) {

            if (ts.isMethodDeclaration(member)) {

              let text = NodeText(member);

              output.push(text + '\n');

            }
            else if (ts.isPropertyDeclaration(member) 
                || ts.isConstructorDeclaration(member)) {
              output.push(NodeText(member) + '\n');
              // console.info('');
            }
            else if (ts.isAccessor(member)) {
               output.push(NodeText(member) + '\n');
            }
            else {
              console.info('?: ', ts.SyntaxKind[member.kind]);
            }

          }

          output.push(`}\n`); // // ${name}`);
        }

        break;
      
      case ts.SyntaxKind.ImportDeclaration:
      case ts.SyntaxKind.ExportDeclaration:
      case ts.SyntaxKind.EndOfFileToken:
        break;

      default:
        console.info('??', ts.SyntaxKind[child.kind]);
        break;

    }

  });

  // console.info('');

  const DumpList = (list: Record<string, number>) => {
    const keys = Object.keys(list);
    keys.sort();
    for (const key of keys) { console.info('\t' + key); }
  }

  /*
  console.info('Referenced');
  DumpList(referened_type_list);

  console.info('Declared');
  DumpList(declared_type_list);
  */

  // remove any referenced + declared

  const declared_keys = Object.keys(declared_type_list);
  const remaining: string[] = [];

  for (const key of Object.keys(referened_type_list)) {
    if (!declared_keys.includes(key)){
      remaining.push(key);
    }
  }

  // console.info("BALANCE");
  // for (const key of remaining) { console.info('\t' + key + ': ' + (import_target_list[key] || '(unknown)')); }

  // group by target...

  const grouped: Record<string, string[]> = {};
  for (const key of remaining) {
    const target = import_target_list[key];
    if (target) {
      if (!grouped[target]) { grouped[target] = []; }
      grouped[target].push(key);
    }
  }

  // console.info(grouped);

  const composite: Record<string, string> = {};

  for (const key of Object.keys(grouped)) {
    // console.info("K", key);
    if (key.startsWith('.')) {
      let target = path.resolve(path.dirname(base), key);
      target = path.dirname(target) + path.sep + path.basename(key) + '.d.ts';
      const collected = await CollectTypes(target, grouped[key]);
      // console.info("COLLECTED", collected);
      for (const type of Object.keys(collected)) { composite[type] = collected[type]; }
    }
    else {
      let target = path.resolve('../declaration', key);
      if (!/\//.test(key)) {
        target = path.resolve(target, 'src', 'index');
      }
      target = path.dirname(target) + path.sep + path.basename(target) + '.d.ts';
      // console.info("J", target);
      const collected = await CollectTypes(target, grouped[key]);
      // console.info("COLLECTED", collected);
      for (const type of Object.keys(collected)) { composite[type] = collected[type]; }
    }
  }

  const composite_keys = Object.keys(composite);

  remaining.sort();

  for (const key of remaining) {
    if (composite_keys.includes(key)) {
      console.info(key, 'found');
    }
    else {
      console.info(key, 'NOT found');
    }
  }

  /*
  const test = grouped['treb-base-types'];
  console.info("T", test);
  const collected = await CollectTypes('../declaration/treb-base-types/src/index.d.ts', test);
  console.info("COLLECTED", collected);
  */

  // console.info("COMPOSITE", composite);

  if (2>1) return;



  for (const cat of cats) {
    const text = await fs.promises.readFile(cat, {encoding: 'utf8'});
    output.unshift(text + '\n');
  }

  if (pkg) {
    const banner = await Banner();
    output.unshift('\n' + banner);
  }

  if (output_file) {
    console.info('writing to', output_file)
    await fs.promises.writeFile(output_file, output.join('\n'), {encoding: 'utf8'});
  }
  else {
    console.info(output.join('\n'));
  }

};

if (base) { 
  Run(); 
}

