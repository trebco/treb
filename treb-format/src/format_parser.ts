
import { NumberFormatSection } from './number_format_section';
import { TextPartFlag, TextPart } from 'treb-base-types';

const ASTERISK = 0x2A;  // TODO
const UNDERSCORE = 0x5F;  // TODO

const QUESTION_MARK = 0x3F;
const ZERO = 0x30;
const PERIOD = 0x2E;
const COMMA = 0x2C;
const PERCENT = 0x25;
const DOUBLE_QUOTE = 0x22;
const NUMBER_SIGN = 0x23;
const SEMICOLON = 0x3B;
const BACKSLASH = 0x5C;
const AT = 0x40;
const LEFT_BRACE = 0x5B;
const RIGHT_BRACE = 0x5D;

const UPPERCASE_E = 0x45;
const LOWERCASE_E = 0x65;

const UPPERCASE_H = 0x48;
const LOWERCASE_H = 0x68;
const UPPERCASE_M = 0x4D;
const LOWERCASE_M = 0x6D;
const UPPERCASE_S = 0x53;
const LOWERCASE_S = 0x73;
const UPPERCASE_D = 0x44;
const LOWERCASE_D = 0x64;
const UPPERCASE_Y = 0x59;
const LOWERCASE_Y = 0x79;
const UPPERCASE_A = 0x41;
const LOWERCASE_A = 0x61;

enum NumberPart {
  Integer = 0,
  Decimal = 1,
}

export class FormatParser {

  /**
   * parser is static (essentially a singleton). state is ephemeral.
   *
   * it's a little hard to unify parsing for dates and numbers.
   * luckily we don't have to parse that often; only when a format
   * is created. so we will do some extra work here.
   */
  public static Parse(pattern: string) {

    // local
    this.pattern = pattern;

    // convert to numbers
    this.characters = pattern.split('').map((char) => char.charCodeAt(0));

    // pointer
    this.char_index = 0;

    // allocate initial section
    this.current_section = new NumberFormatSection();
    this.sections = [this.current_section];

    // check if it's a date, if so we can move on
    if (this.ParseDatePattern()) {
      return this.sections;
    }

    // not a date; reset and try again

    this.char_index = 0;
    this.current_section = new NumberFormatSection();
    this.sections = [this.current_section];

    // parse
    while (this.char_index < this.characters.length) {
      this.ConsumeChar();
    }

    // result
    return this.sections;

  }

  protected static date_pattern = false;
  protected static pattern = '';
  protected static char_index = 0;
  protected static characters: number[] = [];
  protected static sections: NumberFormatSection[] = [];
  protected static current_section: NumberFormatSection = new NumberFormatSection();
  protected static preserve_formatting_characters = false; // true;

  // FIXME: localization

  protected static decimal_mark = PERIOD;
  protected static group_separator = COMMA;

  protected static ConsumeString() {
    let text = '';
    if (this.preserve_formatting_characters) {
      text += this.pattern[this.char_index]; // "
    }
    for (++this.char_index; this.char_index < this.characters.length; this.char_index++) {
      const char = this.characters[this.char_index];
      switch (char) {
        case BACKSLASH: // escape character
          if (this.preserve_formatting_characters) {
            text += this.pattern[this.char_index];
          }
          if ((this.char_index + 1) < this.characters.length) {
            text += this.pattern[++this.char_index];
          }
          break;
        case DOUBLE_QUOTE:
          if (this.preserve_formatting_characters) {
            text += this.pattern[this.char_index]; // "
          }
          this.char_index++;
          return text;
        default:
          text += this.pattern[this.char_index];
          break;
      }
    }
    throw new Error('unterminated string');
  }

  protected static ConsumeFormatting() {
    let text = '';
    for (++this.char_index; this.char_index < this.characters.length; this.char_index++) {
      const char = this.characters[this.char_index];
      switch (char) {
        case BACKSLASH:
          throw new Error('invalid escape character in formatting block');

        case RIGHT_BRACE:
          this.char_index++;
          return text;

        default:
          text += this.pattern[this.char_index];
          break;
      }
    }
    throw new Error('unterminated format');
  }

  /**
   * number format proper contains only the following characters:
   * +-0#.,
   * anything else will be ignored
   */
  protected static ConsumeNumberFormat() {

    let number_part = NumberPart.Integer;

    for (this.char_index; this.char_index < this.characters.length; this.char_index++) {
      const char = this.characters[this.char_index];
      switch (char) {

        case this.group_separator:

          // the behavior of this token is different at the end of the number
          // format. in that case, each comma represents 'scale by 1000'. so
          // we need to do lookahead... but we only one character?

          let lookahead_digit = false;
          for (let i = this.char_index + 1; !lookahead_digit && i < this.characters.length; i++) {
            const next_char = this.characters[i];
            if (next_char === this.decimal_mark
              || next_char === NUMBER_SIGN
              || next_char === ZERO) {
              lookahead_digit = true;
            }
            else if (next_char !== COMMA) { break; }
          }
          if (lookahead_digit) {
            if (number_part === NumberPart.Decimal) {
              throw new Error('invalid grouping in decimal part');
            }
            this.current_section.grouping = true;
          }
          else {
            this.current_section.scaling = (this.current_section.scaling || 1) * 1000;
          }
          break;

        case this.decimal_mark:
          if (number_part === NumberPart.Decimal) {
            throw new Error('too many decimal marks');
          }
          number_part = NumberPart.Decimal;
          break;

        case NUMBER_SIGN:

          // spacing. allowing for some junk, we treat these as required
          // if they're inside of zeros (after in the case of integer, before
          // in the case of decimal)

          if (number_part === NumberPart.Decimal) {
            this.current_section.decimal_max_digits++;
          }
          else if (this.current_section.integer_min_digits) {
            this.current_section.integer_min_digits++;
          }

          break;

        case ZERO:

          // required digit.

          if (number_part === NumberPart.Decimal) {
            this.current_section.decimal_max_digits++;
            this.current_section.decimal_min_digits = this.current_section.decimal_max_digits;
          }
          else {
            this.current_section.integer_min_digits++;
          }
          break;

        default:

          // non-number format character; we're done?

          return;

      }
    }

  }

  protected static AppendCharAsText(advance_pointer = true) {
    if (this.current_section.has_number_format) {
      this.current_section.suffix[this.current_section.suffix.length - 1].text += this.pattern[this.char_index];
    }
    else {
      this.current_section.prefix[this.current_section.prefix.length - 1].text += this.pattern[this.char_index];
    }
    if (advance_pointer) {
      this.char_index++;
    }
  }

  protected static AppendString(text: string) {
    if (this.current_section.has_number_format) {
      this.current_section.suffix[this.current_section.suffix.length - 1].text += text;
    }
    else {
      this.current_section.prefix[this.current_section.prefix.length - 1].text += text;
    }
  }

  protected static AppendTextPart(part: TextPart) {
    if (this.current_section.has_number_format) {
      this.current_section.suffix.push(part);
      this.current_section.suffix.push({ text: '' });
    }
    else {
      this.current_section.prefix.push(part);
      this.current_section.prefix.push({ text: '' });
    }
  }

  protected static ConsumeChar() {

    const char = this.characters[this.char_index];

    switch (char) {
      case SEMICOLON:

        // FIXME: there's a concept of an "empty" section, which is
        // zero-length text between semicolons (or before the first
        // semicolon). we should treat those as cloned or synthentic.

        // actually, is that legal for the first section? possibly not.

        this.char_index++; // discard
        this.current_section = new NumberFormatSection();
        if (this.sections.length === 3) this.current_section.string_format = true;
        this.sections.push(this.current_section);
        break;

      case AT:

        this.char_index++;
        this.AppendTextPart({
          text: '@', flag: TextPartFlag.literal,
        });
        this.current_section.string_format = true; // force
        break;

      case ZERO:
      case NUMBER_SIGN:
      case PERIOD:
      case COMMA:

        // only one actual format. anything else is treated as text.
        // also skip for string format (#4)

        if (!this.current_section.has_number_format && !this.current_section.string_format) {
          this.ConsumeNumberFormat();
          this.current_section.has_number_format = true;
        }
        else {
          this.AppendCharAsText();
        }
        break;

      case LEFT_BRACE:
        const formatting = this.ConsumeFormatting();
        this.AppendTextPart({ text: formatting, flag: TextPartFlag.formatting });
        break;

      case DOUBLE_QUOTE:
        const text = this.ConsumeString();
        this.AppendString(text);
        break;

      case QUESTION_MARK: // this is like _0
        if (this.preserve_formatting_characters) {
          this.AppendCharAsText();
        }
        else {
          this.AppendTextPart({
            text: '0',
            flag: TextPartFlag.hidden,
          });
          this.char_index++;
        }
        break;

      case UNDERSCORE:
        if (this.preserve_formatting_characters) {
          this.AppendCharAsText();
        }
        else {
          if (++this.char_index >= this.characters.length) {
            throw new Error('invalid pad character at end');
          }
          this.AppendTextPart({
            text: this.pattern[this.char_index++],
            flag: TextPartFlag.hidden,
          });
        }
        break;

      case ASTERISK:
        if (this.current_section.has_asterisk) {
          throw new Error(`we don't support multiple asterisks`);
        }
        if (this.preserve_formatting_characters) {
          this.AppendCharAsText();
        }
        else {
          if (++this.char_index >= this.characters.length) {
            throw new Error('invalid pad character at end');
          }
          this.AppendTextPart({
            text: this.pattern[this.char_index++],
            flag: TextPartFlag.padded,
          });
          this.current_section.has_asterisk = true;
        }
        break;

      case LOWERCASE_E:
      case UPPERCASE_E:

        if (this.current_section.percent ||
          this.current_section.exponential ||
          this.current_section.string_format) {
          this.AppendCharAsText();
        }
        else {
          this.current_section.exponential = true;
          this.char_index++;
        }
        break;

      case PERCENT:

        if (!this.current_section.exponential && !this.current_section.string_format) {
          this.current_section.percent = true;
        }
        this.AppendCharAsText();
        break;

      case BACKSLASH:
        if (this.preserve_formatting_characters) {
          this.AppendCharAsText(false);
        }
        if (++this.char_index >= this.characters.length) {
          throw new Error('invalid escape character at end');
        }
        this.AppendCharAsText();
        break;

      default:
        this.AppendCharAsText();

    }
  }

  /**
   * we treat it as a date pattern if there's an unquoted date/time letter
   * (one of [hmsdyHMSDY]). technically mixing date formats and number
   * formats (#0) is illegal. we will just drop into number formats for those.
   */
  protected static ParseDatePattern() {
    this.date_pattern = true;
    while (this.date_pattern && this.char_index < this.pattern.length) {
      this.DatePatternConsumeChar();
    }

    // one more check: there has to be a date format part in there
    if (this.date_pattern) {
      this.date_pattern = false;
      for (const section of this.sections) {
        for (const part of section.prefix) {
          // tslint:disable-next-line: no-bitwise
          if (part.flag && (part.flag & (TextPartFlag.date_component | TextPartFlag.date_component_minutes))) {
            this.date_pattern = true;
          }
        }
      }
    }

    // if it _is_ a date pattern, set the section flag.
    if (this.date_pattern) {
      this.sections[0].date_format = true;

      // check for minutes, and set the flag (actually state in the text
      // part). in date formats mm means months _unless_ it is preceded
      // by an hh or followed by an ss.

      this.sections[0].prefix.forEach((item, index) => {
        if (item.flag === TextPartFlag.date_component && (item.text === 'mm' || item.text === 'm')) {
          if (index) {
            for (let i = index - 1; i; i--) {
              const test = this.sections[0].prefix[i];
              if (test.flag === TextPartFlag.date_component) {
                if (/h/i.test(test.text)) {
                  item.flag = TextPartFlag.date_component_minutes;
                  item.text = item.text.toLowerCase(); // normalize
                }
                break;
              }
            }
          }
          if (index < this.sections[0].prefix.length - 1) {
            for (let i = index + 1; i < this.sections[0].prefix.length; i++) {
              const test = this.sections[0].prefix[i];
              if (test.flag === TextPartFlag.date_component) {
                if (/s/i.test(test.text)) {
                  item.flag = TextPartFlag.date_component_minutes;
                  item.text = item.text.toLowerCase(); // normalize
                }
                break;
              }
            }
          }
        }
      });

    }
    return this.date_pattern;
  }

  /**
   * date parts are repeated sequences (e.g. ddd). we allow
   * fractional seconds with ss.00.
   */
  protected static ConsumeDatePart() {
    const initial_char = this.pattern[this.char_index++];
    const normalized = initial_char.toLowerCase();

    const part: TextPart = {
      text: initial_char,
      flag: TextPartFlag.date_component,
    };

    while (this.pattern[this.char_index] && (this.pattern[this.char_index].toLowerCase() === normalized)) {
      part.text += (this.pattern[this.char_index++]);
    }

    // partial seconds

    if (normalized === 's' && this.pattern[this.char_index] === '.') {
      part.text += (this.pattern[this.char_index++]);
      while (this.pattern[this.char_index] === '0') {
        part.text += (this.pattern[this.char_index++]);
      }
    }

    return part;
  }

  /**
   * special patterns for am/pm in date formats
   */
  protected static ConsumeAMPM(): TextPart | undefined {

    let test = this.pattern.substr(this.char_index, 5);
    if (test === 'am/pm' || test === 'AM/PM') {
      this.char_index += 5;
      this.sections[0].twelve_hour = true;
      return { text: test, flag: TextPartFlag.date_component };
    }

    test = this.pattern.substr(this.char_index, 3);
    if (test === 'a/p' || test === 'A/P') {
      this.char_index += 3;
      this.sections[0].twelve_hour = true;
      return { text: test, flag: TextPartFlag.date_component };
    }

    return undefined;
  }

  protected static DatePatternConsumeChar() {

    const char = this.characters[this.char_index];

    switch (char) {
      case SEMICOLON:

        // only one section allowed for dates (not sure why). just ignore
        // everything after the semicolon, but don't invalidate the pattern.
        this.char_index = this.characters.length; // end
        break;

      case ZERO:
      case NUMBER_SIGN:
      // case PERIOD:
      // case COMMA:
      case LOWERCASE_E:
      case UPPERCASE_E:
      case PERCENT:
      case AT:

        // this is not a date format.
        this.date_pattern = false;
        break;

      case UPPERCASE_H:
      case LOWERCASE_H:
      case UPPERCASE_M:
      case LOWERCASE_M:
      case UPPERCASE_S:
      case LOWERCASE_S:
      case UPPERCASE_D:
      case LOWERCASE_D:
      case UPPERCASE_Y:
      case LOWERCASE_Y:
        this.AppendTextPart(this.ConsumeDatePart());
        break;

      case UPPERCASE_A:
      case LOWERCASE_A:
        const ampm = this.ConsumeAMPM();
        if (!!ampm) this.AppendTextPart(ampm);
        else this.AppendCharAsText();
        break;

      case DOUBLE_QUOTE:
        const text = this.ConsumeString();
        this.AppendString(text);
        break;

      case QUESTION_MARK: // this is like _0
        if (this.preserve_formatting_characters) {
          this.AppendCharAsText();
        }
        else {
          this.AppendTextPart({
            text: '0',
            flag: TextPartFlag.hidden,
          });
          this.char_index++;
        }
        break;

      case UNDERSCORE:
        if (this.preserve_formatting_characters) {
          this.AppendCharAsText();
        }
        else {
          if (++this.char_index >= this.characters.length) {
            throw new Error('invalid pad character at end');
          }
          this.AppendTextPart({
            text: this.pattern[this.char_index++],
            flag: TextPartFlag.hidden,
          });
        }
        break;

      case ASTERISK:
        if (this.current_section.has_asterisk) {
          throw new Error(`we don't support multiple asterisks`);
        }
        if (this.preserve_formatting_characters) {
          this.AppendCharAsText();
        }
        else {
          if (++this.char_index >= this.characters.length) {
            throw new Error('invalid pad character at end');
          }
          this.AppendTextPart({
            text: this.pattern[this.char_index++],
            flag: TextPartFlag.padded,
          });
          this.current_section.has_asterisk = true;
        }
        break;

      case BACKSLASH:
        if (this.preserve_formatting_characters) {
          this.AppendCharAsText(false);
        }
        if (++this.char_index >= this.characters.length) {
          throw new Error('invalid escape character at end');
        }
        this.AppendCharAsText();
        break;

      default:
        this.AppendCharAsText();

    }
  }

}
