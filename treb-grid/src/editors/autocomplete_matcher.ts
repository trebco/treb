
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
}

export interface TooltipParserResult {
  function: string|undefined;
  argument: number;
}

export class AutocompleteMatcher {

  private function_names: string[] = [];
  private token_names: string[] = [];

  private function_map: {[index: string]: FunctionDescriptor} = {};

  private argument_separator = Localization.argument_separator.charCodeAt(0);

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
      match = data.text.match(/(?:^|[^A-Za-z_])([A-Za-z_][\w\d_.]*)\s*$/);
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

        result.tooltip = func.name;
        result.arguments = '(' + (func.arguments || []).map((desc, index) => {
          const argument = desc.name || 'argument';
          return (index === parsed.argument) ? `<span class="active-argument">${argument}</span>` : argument;
        }).join(Localization.argument_separator + ' ') + ')';
        result.description = func.description ? `<span class="function-description">${func.description}</span>` : '';
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
    const stack: Array<{buffer: string; argument: number }> = [];

    let argument = 0;
    let buffer = '';

    // state flag
    let quote = false;

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
    }

    return {
      function: stack.pop()?.buffer || undefined,
      argument,
    };

  }

}
