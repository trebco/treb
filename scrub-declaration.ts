
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

let base: string;
let output_file: string;

for (let i = 0; i < process.argv.length; i++) {
  if (process.argv[i] === '--base') {
    base = process.argv[++i];
  }
  else if (process.argv[i] === '--output') {
    output_file = process.argv[++i];
  }
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

const Run = async (): Promise<void> => {

  const output: string[] = [];

  const text = await fs.promises.readFile(base, {encoding: 'utf8'});
  const node = ts.createSourceFile(base, text, ts.ScriptTarget.Latest, true);
  // console.info(node);

  // simple: dump node
  const NodeText = (child: ts.Node) => Scrub(text.substring(child.pos, child.end));

  node.forEachChild(child => {

    const modifiers = (child.modifiers || []).map(member => {
      return ts.SyntaxKind[member.kind];
    });

    // only look at exported class/interface/enum/type

    if (!modifiers.includes('ExportKeyword')) {
      return;
    }

    // check for @internal

    const tags = GetDocTags(child);
    if (tags.includes('internal')) {
      return;
    }

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

            if (ts.isPropertyDeclaration(member) 
                || ts.isConstructorDeclaration(member)
                || ts.isMethodDeclaration(member)) {
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

