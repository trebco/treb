/**
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
 * with Foobar. If not, see <https://www.gnu.org/licenses/>. 
 *
 * Copyright 2022 trebco, llc. + info@treb.app
 */

const app_version = typeof navigator === 'undefined' ? '' : navigator.appVersion;
const user_agent = typeof navigator === 'undefined' ? '' : navigator.userAgent;

// console.warn('using fake UA: ' + user_agent);

/**
 * some basic user-agent sniffing. we use less than we used to, except
 * for making the determination of modern (grid)/legacy layout.
 * 
 * FIXME: move to base_types, we need it in toolbar
 * 
 */
class UAType {

  /** we need this for some edge-specific weirdness */
  public readonly is_edge = /Edge/.test(app_version);

  /** more testing. ios safari doesn't support grid+sticky (apparently) */
  public readonly is_ipad = /iPad|iPhone/.test(user_agent);

  /** more testing. firefox android doesn't support grid+sticky (apparently) */
  public readonly is_android = /android|samsung/i.test(user_agent);

  /** mobile we want slightly different keyboard behavior */
  public readonly is_mobile = this.is_ipad || this.is_android;
 
  /** more testing. firefox android doesn't support grid+sticky (apparently) */
  public readonly is_firefox = /firefox/i.test(user_agent);

  /** ... */
  public readonly is_safari = /safari/i.test(user_agent) && !/edg/i.test(user_agent);

  /** ... */
  public readonly is_mac = /macintosh/i.test(user_agent);

  /** ... */
  public readonly is_chrome = /Chrome/i.test(user_agent);

  /* * this is for events (IE11 does't support event constructor) * /
  public trident = ((typeof navigator !== 'undefined') &&
    user_agent && /trident/i.test(user_agent));
  */

  /** ... */
  public is_windows = /win64|win32|windows\s+nt/i.test(user_agent);

  // safari doesn't seem to hold the sticky elements in place. not
  // sure why not, though, need to do some more testing. legacy
  // renderer on safari has no scrollbars...

  // position: -webkit-sticky fixes the sticky issue, behavior seems
  // consistent with cr/ffx. also fixes on ios, but we lost the scrollbars.

  // blinking on safari handled with -webkit-tap-highlight-color: transparent;
  // but we still have no scrollbars. it may be that we never have them...

  /** temp only: need a more robust check */
  public readonly is_modern =
    (!this.is_edge) &&
    // (!this.is_ipad) &&
    // (!this.is_mac || (this.is_chrome || this.is_firefox)) &&
    (!(this.is_firefox && this.is_android)) &&
    /webkit|firefox/i.test(user_agent);
}

const null_ua = {

    is_edge: false,
    is_ipad: false,
    is_android: false,
    is_firefox: false,
    is_safari: false,
    is_mac: false,
    is_chrome: false,
    trident: false,
    is_windows: false,
    is_modern: true,
    is_node: true,
    is_mobile: false,

};

export const UA = (typeof navigator === 'undefined') ? null_ua : new UAType();
