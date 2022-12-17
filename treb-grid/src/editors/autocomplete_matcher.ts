/*
 * This file is part of TREB.
 *
 * TREB is free software: you can redistribute it and/or modify it under the 
 * terms of the GNU General Public License as published by the Free Software 
 * Foundation, either version 3 of the License, or (at your option) any 
 * later version.
 *
 * TREB is distributed in the hope that it will be useful, but WITHOUT ANY 
 * WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS 
 * FOR A PARTICULAR PURPOSE. See the GNU General Public License for more 
 * details.
 *
 * You should have received a copy of the GNU General Public License along 
 * with TREB. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022 trebco, llc. 
 * info@treb.app
 * 
 */

/**
 * this is the data side of autocomplete (maintaining the list, matching).
 * we add this to grid because grid controls the editors; clients can pass
 * in lists.
 *
 * TODO: structure
 * TODO: other symbols... [FIXME: defined names need to go in here]
 * TODO: context -- cell vs annotation (...)
 *
 * FIXME: why does this use different definitions than the functions? 
 * can't we merge the two?
 * 
 * [I think they may have been developed independently and them converged...]
 * 
 */

import { Localization } from 'treb-base-types';

export interface ArgumentDescriptor {
  name?: string;
}

export enum DescriptorType {
  Function, Token
}

export interface FunctionDescriptor {
  name: string;
  description?: string;
  arguments?: ArgumentDescriptor[];
  type?: DescriptorType;
}

export interface AutocompleteMatchData {
  text: string;
  cursor: number;
}

export interface AutocompleteExecResult {
  // completions?: string[]; 
  completions?: FunctionDescriptor[];
  token?: string;
  position?: number;
  tooltip?: string;
  arguments?: string;
  description?: string;
  function_position?: number;
}

export interface TooltipParserResult {
  function: string|undefined;
  argument: number;
  position: number;
}

export class AutocompleteMatcher {

  private function_names: string[] = [];

  //private function_map: {[index: string]: FunctionDescriptor} = {};

  private argument_separator = Localization.argument_separator.charCodeAt(0);

  /**
   * making this public (and scrubbing the type). we need it public so we 
   * can check collisions. I'm not sure why it was originally private...
   */
  public function_map: Record<string, FunctionDescriptor> = {};

  public RemoveFunctions(functions: FunctionDescriptor|FunctionDescriptor[]): void {
    if (!Array.isArray(functions)) { functions = [functions]; }
    let list = Object.keys(this.function_map).map((key) => this.function_map[key]);
    for (const func of functions) {
      list = list.filter(test => test.name !== func.name);
    }
    this.SetFunctions(list);
  }

  public AddFunctions(functions: FunctionDescriptor|FunctionDescriptor[]): void {
    if (!Array.isArray(functions)) { functions = [functions]; }
    const list = Object.keys(this.function_map).map((key) => this.function_map[key]).concat(...functions);
    this.SetFunctions(list);
  }

  public SetFunctions(functions: FunctionDescriptor[]): void {
    this.function_map = {};
    this.function_names = functions.map((fn) => {
      this.function_map[fn.name.toLowerCase()] = fn;
      return fn.name;
    }).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }

  public NormalizeIdentifier(name: string): string|undefined {
    const identifier = this.function_map[name.toLowerCase()];
    return identifier ? identifier.name : undefined;
  }

  public Exec(data: AutocompleteMatchData): AutocompleteExecResult {

    // ac/tt only for formula
    if (data.text[0] !== '=') {
      return {};
    }

    let match;
    let result: AutocompleteExecResult = {};

    // ac only at the end of the string
    if (data.cursor === data.text.length) {

      // FIXME: quoted strings...

      // if it's a token, and ends with a legal character
      // UPDATE: adding the negative leading \d to fix entering complex numbers

      match = data.text.match(/(?:^|[^A-Za-z_\d])([A-Za-z_][\w\d_.]*)\s*$/);

      if (match) {
        const token = match[1];
        const rex = new RegExp('^' + token.replace('.', '\\.'), 'i');
        const list = this.function_names.filter((name) => rex.test(name)).map((name) => this.function_map[name.toLowerCase()]);

        result = {
          completions: list, 
          token, 
          position: data.cursor - token.length,
        };

      }

    }

    const parsed = this.ParseTooltip(data.text.substr(0, data.cursor));

    if (parsed.function) {
      const func = this.function_map[parsed.function.toLowerCase()];
      if (func) {
        // if (func.canonical_name) result.tooltip = func.canonical_name;
        // else result.tooltip = tt.toUpperCase();

        result.tooltip = '<span class="notranslate">' + func.name + '</span>';
        result.arguments = '(' + (func.arguments || []).map((desc, index) => {
          const argument = desc.name || 'argument';
          return (index === parsed.argument) ? `<span class="active-argument">${argument}</span>` : argument;
        }).join(Localization.argument_separator + ' ') + ')';
        result.description = func.description ? `<span class="function-description">${func.description}</span>` : '';
        result.function_position = parsed.position || 0;

      }
    }

    return result;
  }

  /**
   * baby parser for generating tooltips. we want the name of the 
   * current function, and the index of the current argument.
   * 
   * not handled: escaped quotes (not even sure what the syntax for that is)
   */
  public ParseTooltip(expression: string): TooltipParserResult {

    // these two things are actually unrelated, we just need to push/pop them at the same time
    const stack: Array<{
      buffer: string; 
      position: number;
      argument: number; }> = [];

    let argument = 0;
    let buffer = '';

    // state flag
    let quote = false;

    let position = 0;
    for (const letter of expression) {
     
      const char = letter.charCodeAt(0);
      if (quote) {
        if (char === 0x22) { quote = false; }
      }
      else {
        switch (char) {
          case 0x28: // OPEN_PAREN:
            stack.push({
              buffer: buffer.trim(), // there is no case where spaces get in this buffer
              argument,
              position: position - buffer.length,
            });
            buffer = '';
            argument = 0;
            break;
    
          case this.argument_separator:
            argument++;
            break;
    
          case 0x29: // CLOSE_PAREN:
            argument = stack.pop()?.argument || 0;
            break;
    
          case 0x22: // QUOTE:
            buffer = '';
            quote = true;
            break;

          default:

            // these are legal symbol characters
            if ( (char >= 0x61 && char <= 0x7a) // a-z
              || (char >= 0x41 && char <= 0x5a) // A-Z
              || (char >= 0x30 && char <= 0x39) // 0-9
              || (char === 0x5f)                // _
              || (char === 0x2e)) {             // .
    
              buffer += letter;
            }
            else {
              buffer = '';
            }
    
          }
      }

      position++;

    }

    const last_func = stack.pop();

    return {
      function: last_func?.buffer || undefined,
      position: last_func?.position || 0,
      argument,
    };

  }

}
