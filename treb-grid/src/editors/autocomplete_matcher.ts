
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

export interface FunctionDescriptor {
  name: string;
  description?: string;
  arguments?: ArgumentDescriptor[];
}

export interface AutocompleteMatchData {
  text: string;
  cursor: number;
}

export interface AutocompleteExecResult {
  completions?: string[]; 
  token?: string;
  position?: number;
  tooltip?: string;
  arguments?: string;
  description?: string;
}

export class AutocompleteMatcher {

  private function_names: string[] = [];
  private function_map: {[index: string]: FunctionDescriptor} = {};

  private argument_separator = Localization.argument_separator.charCodeAt(0);

  public SetFunctions(functions: FunctionDescriptor[]) {
    this.function_map = {};
    this.function_names = functions.map((fn) => {
      this.function_map[fn.name.toLowerCase()] = fn;
      return fn.name;
    }).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  }

  public NormalizeIdentifier(name: string) {
    const identifier = this.function_map[name.toLowerCase()];
    return identifier ? identifier.name : undefined;
  }

  public Exec(data: AutocompleteMatchData) {

    // ac/tt only for formula
    if (data.text[0] !== '=') return {};

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
        const list = this.function_names.filter((name) => rex.test(name));
        result = {
          completions: list, 
          token, 
          position: data.cursor - token.length,
        };
      }

    }

    // check for tt: we're in a function call
    // let's do a baby parser

    /*
    let sub = data.text.substr(0, data.cursor);

    const closed_function = /(?:^|[^A-Za-z_])([A-Za-z_][\w\d_.]*\s*\([^()]*\))/;
    const open_function = /([A-Za-z_][\w\d_.]*)\s*\(/g;

    match = sub.match(closed_function);
    while (match) {
      sub = sub.substr(0, (match.index || 0) + 1) + sub.substr((match.index || 0) + 1 + match[1].length);
      match = sub.match(closed_function);
    }

    let tt = '';
    match = open_function.exec(sub);
    while (match) {
      tt = match[1];
      match = open_function.exec(sub);
    }
    */

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
        result.description = `<span class="function-description">${func.description}</span>`;
      }
    }

    return result;
  }

  /**
   * baby parser for generating tooltips. we want the name of the 
   * current function, and the index of the current argument
   */
  public ParseTooltip(expression: string) {

    const stack: Array<{buffer: string; argument: number }> = [];
    let argument = 0;
    let buffer = '';
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
              buffer: buffer.trim(), 
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
            quote = true;
            break;

          default:
            if ( (char >= 0x61 && char <= 0x7a)
              || (char >= 0x41 && char <= 0x5a)
              || (char >= 0x30 && char <= 0x39)
              || (char === 0x5f)
              || (char === 0x2e)) {
    
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
