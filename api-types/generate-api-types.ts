
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
import { config } from './api-config';

console.info("CFG", config);

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

function transformer<T extends ts.Node>(): ts.TransformerFactory<T> {

  let verbose = false;

  return context => {
    const visit: ts.Visitor = node => {

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

      if (ts.isInterfaceDeclaration(node) || ts.isEnumDeclaration(node) || ts.isClassDeclaration(node)) {
        if (!modifiers.includes('ExportKeyword')) {
          return undefined;
        }        
      }

      if (ts.isTypeReferenceNode(node)) {
        if (ts.isIdentifier(node.typeName)) {
          const key = node.typeName.escapedText.toString();
          referened_type_list[key] = (referened_type_list[key] || 0) + 1;
        }
      }

      if (ts.isClassDeclaration(node)) {
        if (ts.isIdentifier(node.name)) {
          const match = config.rename_classes[node.name.escapedText.toString()];
          if (match) {
            const tmp = ts.factory.createClassDeclaration(
              node.decorators,
              node.modifiers,
              ts.factory.createIdentifier(match),
              node.typeParameters,
              node.heritageClauses,
              node.members,
            );
            return ts.visitEachChild(tmp, child => visit(child), context);
          }
        }
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

  console.info(referened_type_list);

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
 
          // jsdoc for class? (...)

          // this is a hack
          output.push(`export declare class ${name} {\n`);

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

      default:
        console.info('??', ts.SyntaxKind[child.kind]);
        break;

    }

    // console.info('');

  });

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

