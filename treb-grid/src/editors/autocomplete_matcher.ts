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
 * Copyright 2022-2025 trebco, llc. 
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

/*
export enum DescriptorType {
  Function, Token
}
*/

export interface FunctionDescriptor {
  name: string;
  description?: string;
  arguments?: ArgumentDescriptor[];

  /** switching to literals */
  type?: 'function'|'token';

  /** this is a named range or named expression. meaning a user/non-system name. */
  named?: boolean;

  /** scope refers to sheet IDs. names may be scoped. */
  scope?: number;
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
  // private function_map: {[index: string]: FunctionDescriptor} = {};

  private argument_separator = Localization.argument_separator.charCodeAt(0);

  /**
   * making this public (and scrubbing the type). we need it public so we 
   * can check collisions. I'm not sure why it was originally private...
   * 
   * that's backwards. this should be private, and anyone checking 
   * collisions should ask. also updating to modern type.
   * 
   * OK so now a map. all names should be lower-cased for consistency (they
   * can maintain canonical names inside the object).
   */
  private function_map: Map<string, FunctionDescriptor> = new Map();

  public RemoveFunctions(functions: FunctionDescriptor|FunctionDescriptor[]): void {
    if (!Array.isArray(functions)) { functions = [functions]; }
    for (const entry of functions) {
      this.function_map.delete(entry.name.toLowerCase());
    }
    this.UpdateNameList();
  }

  public AddFunctions(functions: FunctionDescriptor|FunctionDescriptor[]): void {
    if (!Array.isArray(functions)) { functions = [functions]; }
    for (const entry of functions) {
      this.function_map.set(entry.name.toLowerCase(), entry);
    }
    this.UpdateNameList();
  }

  public SetFunctions(functions: FunctionDescriptor[]): void {
    this.function_map.clear();
    for (const entry of functions) {
      this.function_map.set(entry.name.toLowerCase(), entry);
    }
    this.UpdateNameList();
  }

  /**
   * returns the canonical version of the name, if it exists.
   * @param name 
   * @returns 
   */
  public NormalizeIdentifier(name: string): string|undefined {
    return this.function_map.get(name.toLowerCase())?.name;
  }

  /** 
   * accessor for entries. we're not stopping you from modifying 
   * in place, for now, but don't do that. 
   */
  public Get(name: string): FunctionDescriptor|undefined {
    return this.function_map.get(name.toLowerCase());
  }

  public Exec(data: AutocompleteMatchData): AutocompleteExecResult {

    // ac/tt only for formula
    if (data.text[0] !== '=') {
      return {};
    }

    // console.info(data);

    let match;
    let result: AutocompleteExecResult = {};

    // ac only at the end of the string
    if (data.cursor === data.text.length) {

      // FIXME: quoted strings...

      // if it's a token, and ends with a legal character
      // UPDATE: adding the negative leading \d to fix entering complex numbers

      // match = data.text.match(/(?:^|[^A-Za-z_\d])([A-Za-z_][\w\d_.]*)\s*$/);
      match = data.text.match(/(?:^|[^a-zA-Z\u00C0-\u024F_\d])([a-zA-Z\u00C0-\u024F_][\w\d\u00C0-\u024F_.]*)\s*$/);

      if (match) {
        const token = match[1];
        const rex = new RegExp('^' + token.replace('.', '\\.'), 'i');
        const list = this.function_names.filter((name) => 
          rex.test(name)).map((name) => 
            this.function_map.get(name.toLowerCase())).filter((test): test is FunctionDescriptor => !!test);

        result = {
          completions: list, 
          token, 
          position: data.cursor - token.length,
        };

      }
      else {
        // console.info("NOP");
      }

    }

    const parsed = this.ParseTooltip(data.text.substr(0, data.cursor));

    if (parsed.function) {
      const func = this.function_map.get(parsed.function.toLowerCase());
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
              || (char >= 0x00C0 && char <= 0x024F) // accented characters
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

  /**
   * we maintain a sorted list of names. this needs to get updated
   * when the list changes.
   */
  private UpdateNameList() {
    this.function_names = [...this.function_map.keys()].sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }

}
