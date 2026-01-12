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
 * Copyright 2022-2026 trebco, llc. 
 * info@treb.app
 * 
 */

// support for entities removed, as it adds a lot of bloat. we 
// could easily support numbers (+hex), but html entities require
// a table. see
//
// https://html.spec.whatwg.org/entities.json
//
// I don't think we need this, since we're not html -- you can just
// enter utf8 characters. we might think about emoji entities, though,
// along the lines of
//
// https://github.com/markdown-it/markdown-it-emoji
//

// import * as he from 'he';

export interface StringFormat {
  strong?: boolean;
  emphasis?: boolean;

  strike?: boolean; // TODO
  pre?: boolean;    // TODO
}

interface NewlineToken extends StringFormat {
  type: 'newline';
  text: string;
}

interface WhitespaceToken extends StringFormat {
  type: 'whitespace';
  text: string;
}

interface TextToken extends StringFormat {
  type: 'text';
  text: string;
}

interface DelimeterToken extends StringFormat {
  type: 'delimeter';
  text: string;
  left_flanking?: boolean;
  right_flanking?: boolean;
  char: string;
  length: number;
}

type Token = NewlineToken | WhitespaceToken | TextToken | DelimeterToken;

/**
 * this external type only has text information
 */
export interface FormattedString extends StringFormat {
  text: string;
}

/**
 * utility for formatting markdown strings. we split text into tokens 
 * by format. implemented as a factory/singleton, stateless.
 * 
 * note: in case it's not clear, where I reference MD rules, I mean 
 * CommonMark. we may add some GFM as well (strike?).
 * 
 * UPDATE: moving into the parser lib, since it's a parser. even though
 * it's totally independent. (has no deps, though, nice).
 */
export class MDParser {

  private static _instance: MDParser = new MDParser();

  protected constructor() {
    // ...
  }

  public static get instance(): MDParser {
    return this._instance;
  }

  /**
   * given some formatted text (output of the `Parse` method), return HTML.
   * FIXME: is this used outside of testing? seems like we're wasting bytes.
   * 
   * also the way this works adds extra tags if you have nested styles. not
   * an issue if it's just for testing though.
   * 
   * update to optionally not add breaking spaces (<br/>). we need this for
   * containers that are set to white-space: pre-line, where we will already
   * get a linebreak.
   * 
   */
  public HTML(formatted: FormattedString[][], options: { br?: boolean } = {}): string {

    // default options
    options = { br: true, ...options };

    const lines: string[] = [];

    for (const line of formatted) {
      const text: string[] = [];

      for (const element of line) {
        if (element.pre) { text.push('<pre>'); }
        if (element.emphasis) { text.push('<em>'); }
        if (element.strong) { text.push('<strong>'); }
        if (element.strike) { text.push('<strike>'); }

        text.push(element.text);

        if (element.strike) { text.push('</strike>'); }
        if (element.strong) { text.push('</strong>'); }
        if (element.emphasis) { text.push('</em>'); }
        if (element.pre) { text.push('</pre>'); }
      }

      lines.push(text.join(''));
    }

    return lines.join(options.br ? '<br/>\n' : '\n');
    
  }

  /**
   * this is a replacement for the Parse() method, if you don't actually
   * want to parse markdown. the aim is to have a unified result format,
   * even if we're not handling md. 
   */
  public Dummy(text = ''): FormattedString[][] {
    return text.split(/\n/).map(text => [{ text }]);
  }

  /**
   * given some input text, creates a set of text tokens with 
   * emphasis/strong emphasis applied. splits into lines (the 
   * outer array). whitespace (other than newlines) is preserved.
   */
  public Parse(text = ''): FormattedString[][] {

    // first pass: tokenize

    const tokens = this.Tokenize(text);

    // for the most part, MD emphapsis/strong can be parsed as if it were
    // using open/close tags. that's not strictly the case, however, and
    // there is at least one situation that has some required ambiguity.

    // MD does specify "left-flanking" and "right-flanking" delimiter runs,
    // which can open or close formatting, respectively (and a delimeter run
    // may be both left- and right-flanking).

    // second pass: assign those flanks on delimeters. from CM spec:

    /*

    A left-flanking delimiter run is a delimiter run that is (1) not followed by 
    Unicode whitespace, and either (2a) not followed by a punctuation character, 
    or (2b) followed by a punctuation character and preceded by Unicode whitespace 
    or a punctuation character. For purposes of this definition, the beginning and 
    the end of the line count as Unicode whitespace.

    A right-flanking delimiter run is a delimiter run that is (1) not preceded by 
    Unicode whitespace, and either (2a) not preceded by a punctuation character, 
    or (2b) preceded by a punctuation character and followed by Unicode whitespace 
    or a punctuation character. For purposes of this definition, the beginning and 
    the end of the line count as Unicode whitespace.

    */

    // FIXME: could this not be consolidated with "apply formatting", below? or
    // is the concern that if we do that, we might calculate more than once for
    // any given token? it might still be more efficient...

    for (let i = 0; i < tokens.length; i++) {
      const token = tokens[i];
      if (token.type === 'delimeter') {

        const preceding = tokens[i-1];
        const following = tokens[i+1];

        const preceded_by_whitespace = !preceding || preceding.type === 'whitespace' || preceding.type === 'newline';
        const preceded_by_punctuation = preceding && preceding.type === 'text' && /[^\w\d]$/.test(preceding.text);
        
        const followed_by_whitespace = !following || following.type === 'whitespace' || following.type === 'newline';
        const followed_by_punctuation = following && following.type === 'text' && /^[^\w\d]/.test(following.text);

        token.left_flanking = ((!followed_by_whitespace) && ((!followed_by_punctuation) || preceded_by_whitespace));
        token.right_flanking = ((!preceded_by_whitespace) && ((!preceded_by_punctuation) || (followed_by_whitespace || followed_by_punctuation)));

      }
    }

    // next pass does left/right token matching and applies formatting

    this.ApplyFormatting(tokens);

    // last pass consolidates text with like formats, scrubs used tokens
    // (actually changes _unused_ tokens -> text), and splits into lines. 

    /*
    const formatted: FormattedString[][] = this.Consolidate(tokens);

    for (const line of formatted) {
      for (const token of line) {
        token.text = he.decode(token.text);
      }
    }

    return formatted ; // this.Consolidate(tokens) as FormattedString[][];
    */

   return this.Consolidate(tokens) as FormattedString[][];

  }

  /** is this worth a function call? will it get inlined? */
  protected IsWhitespace(char: string): boolean {
    return char === ' ' || char === '\t';
  }

  /** is this worth a function call? will it get inlined? */
  protected IsNewline(char: string): boolean {
    return char === '\r' || char === '\n';
  }

  /** is this worth a function call? will it get inlined? */
  protected IsDelimeter(char: string): boolean {
    return char === '*' || char === '_' || char === '~';
  }

  /**
   * consolidate text with common formatting. splits into lines (newlines are not rendered).
   */
  protected Consolidate(tokens: Token[]): TextToken[][] {
    const result: TextToken[][] = [];
    const format: StringFormat = {};

    let line: TextToken[] = [];
    let current_token: TextToken = {type: 'text', text: ''};
    for (const token of tokens) {
      if (token.type === 'newline') {
        if (current_token.text.length) {
          line.push(current_token);
        }
        current_token = {...format, text: '', type: 'text'};
        result.push(line);
        line = [];
      }
      else {

        // yuck
        
        // can we have a method? or maybe this should be a bitmask, 
        // so we can use === and only have to worry about 0

        if ((!!format.strong !== !!token.strong) || (!!format.emphasis !== !!token.emphasis) || (!!format.strike !== !!token.strike)) {
          format.strong = !!token.strong;
          format.emphasis = !!token.emphasis;
          format.strike = !!token.strike;
          if (current_token.text.length) {
            line.push(current_token);
          }
          current_token = {...format, text: '', type: 'text'};
        }
        switch (token.type) {
          case 'text':
          case 'whitespace':
            current_token.text += token.text;
            break;

          case 'delimeter':
            for (let i = 0; i < token.length; i++) { current_token.text += token.char; }
            break;
            
        }        
      }
    }

    if (current_token.text.length) {
      line.push(current_token);
    }

    if (line.length) {
      result.push(line);
    }

    return result;
  }

  /**
   *
   */
  protected ApplyFormatting(tokens: Token[], open?: DelimeterToken): {index: number, token?: DelimeterToken} {

    // if we're called with no opening token, that's the start
    // of the text block and formatting is clear (no emphasis).

    // console.info("AF", "open", open);

    let index = 0;
    const length = tokens.length;

    for (index = 0; index < length; index++) {
      const token = tokens[index];

      if (token.type === 'delimeter') {

        // check if this token can close (all or in part) our opening tag. 
        // if so, return closing token and index. note that we are checking
        // length > 0 here; that is because operations may reduce the 
        // "available length" when processing.

        if (open && token.right_flanking && open.char === token.char && token.length > 0) {
          // console.info(" ", "close", token);
          return {index, token};
        }

        // if not, see if we can start a new block

        if (token.left_flanking) {
          const result = this.ApplyFormatting(tokens.slice(index + 1), token);
          if (result.token) {

            // what format do we apply? it depends on the MIN of open, close,
            // because it may be a partial close or it may have extra characters.

            const format = Math.min(result.token.length, token.length);

            // what format to we apply to the contained block? depends on the 
            // CLOSING delimeter, which may be < the opening delimeter.

            const strike = token.char === '~';

            const emphasis = !strike && !!(format % 2);
            const strong = !strike && (format >= 2);

            /*
            const formats: string[] = [];
            if (emphasis) formats.push('emphasis');
            if (strong) formats.push('strong');
            console.info('applying', formats, 'to tokens from', index + 1, 'to', index + result.index, `(len ${length})`);
            */

            // apply this format to all the handled tokens (inclusive)

            for (let i = index + 1; i <= index + result.index; i++) {
              tokens[i].strong = (!!tokens[i].strong) || strong;
              tokens[i].emphasis = (!!tokens[i].emphasis) || emphasis;
              tokens[i].strike = (!!tokens[i].strike) || strike;
            }

            // now we have to handle two separate cases. 
            
            // one, the closing  delimeter is shorter than the opening delimeter. 
            // this happens if you have composite formatting (generally three, but
            // could be more) and only partially close, like
            //
            // ___something_ strange__
            //
            // in that case, we want to handle the opening delimeter again, but 
            // only with the remaining length.
            //
            // for case two, closing length >= opening length. in this case, we
            // reduce the lengths of both tokens but don't handle the opening again.
            // in the case of === length, both tokens should basically disappear.
            // if close > open, then the remaining balance will be treated as text.
            // then we can jump ahead by the handled amount.

            result.token.length -= format;
            token.length -= format;

            if (token.length > 0) {
              index--; // repeat 
            }
            else {
              index += result.index;
            }

          }

        }

      }

    }

    // console.info("finished");

    return {index};

  }

  /**
   * 
   */
  protected Tokenize(text = ''): Token[] {
    const tokens: Token[] = [];
    const length = text.length;

    // first pass parse converts text into tokens

    // FIXME: our escape rule is not quite right -- escape turns out to
    // be pretty complicated, see CM spec @ 6.1. punting for the time being,
    // we just always escape the next character.

    let index = 0;
    let escape = false;
    let current_token = ''; // implicit text token

    for (index = 0; index < length; index++) {
      const char = text[index];

      // we do this three times, but it's kind of hard to fold properly

      if (this.IsWhitespace(char)) {

        if (current_token) {
          tokens.push({ type: 'text', text: current_token });
        }

        let tmp = char;
        for (;;) { // while (true) {
          const next_char = text[index+1];
          if (this.IsWhitespace(next_char)) {
            tmp += next_char;
            index++;
          }
          else {
            break;
          }
        }
        tokens.push({
          type: 'whitespace',
          text: tmp,
        })
        escape = false;
        current_token = '';

      }
      else if (this.IsNewline(char)) {

        if (current_token) {
          tokens.push({ type: 'text', text: current_token });
        }

        tokens.push({
          type: 'newline',
          text: char,
        })

        let tmp = '';
        for (;;) { // while (true) {
          const next_char = text[index+1];
          if (this.IsNewline(next_char)) {
            tmp += next_char;
            index++;
          }
          else {
            break;
          }
        }

        if (tmp.length) {
          tokens.push({
            type: 'newline',
            text: tmp,
          });
        }
        escape = false;
        current_token = '';

      }
      else if (escape) {
        current_token += char;
        escape = false;
      }
      else if (this.IsDelimeter(char)) {

        if (current_token) {
          tokens.push({ type: 'text', text: current_token });
        }

        let tmp = char;
        for (;;) { // while (true) {
          const next_char = text[index+1];
          if (next_char === char) { // delimeters do not mix
            tmp += next_char;
            index++;
          }
          else {
            break;
          }
        }
        tokens.push({
          type: 'delimeter',
          text: tmp,
          char,
          length: tmp.length,
        })
        escape = false;
        current_token = '';

      }
      else if (char === '\\') {
        escape = true;
      }
      else {
        current_token += char;
      }

    }

    if (current_token) {
      tokens.push({type: 'text', text: current_token});
    }

    return tokens;
  }

}



