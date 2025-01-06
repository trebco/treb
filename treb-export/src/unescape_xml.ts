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


/*==============================================================================
 * 
 * unescape entities from xml. we were using `he` for this, which is great,
 * but we need it for like 5 entities. we need a hammer where `he` is a nuke.
 * 
 * still I'm not sure we're fully covered. we might need to do numbers, in
 * various formats.
 * 
 * also using regexps is guaranteed to break, eventually, when parsing markup. 
 * a proper parser would be better. but realistically, the kind of xml we are 
 * going to see is not going to have cdata or comments or escaped entities.
 * 
 * famous last words.
 *
 *=============================================================================*/

const entities: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
  '&quot;': '"',
  '&apos;': `'`,
}

const regex = /&\w+;/g;

/**
 * short version
 */
const ShortVersion = (text: string): string => text.replace(regex, pattern => entities[pattern] || pattern);

/**
 * noisy version for dev
 */
const LongVersion = (text: string): string => {
  return text.replace(regex, pattern => {
    if (entities[pattern]) {
      return entities[pattern];
    }
    console.warn('unmapped entity', pattern);
    return pattern;
  });
};

export const Unescape = ShortVersion;

