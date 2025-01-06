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
 * TODO: possibly add an allow-list for remotes
 */
export interface ValidURIOptions {
  
  /** allow data: uri (default true) */
  data: boolean; 

  /** allow same-origin (default true) */
  same_origin: boolean;

  /** allow remote (default false) */
  remote: boolean;

}

const default_uri_options: ValidURIOptions = {
  data: true,
  same_origin: true,
  remote: false,
};

/**
 * check if this resource is a valid URI. by default we only 
 * allow data: and same-origin URIs, but you can override that
 * with a flag.
 * 
 * this assumes we have a document (and location) so it should
 * only be called from browser context.
 */
export const ValidateURI = (resource: string, options: Partial<ValidURIOptions> = {}): string|undefined => {

  const composite: ValidURIOptions = {
    ...default_uri_options,
    ...options,
  };

  // console.info({composite});

  try {
    const url = new URL(resource, document.location.href);
    
    if (url.protocol === 'data:') {
      return composite.data ? url.href : undefined;
    }
    
    if (url.origin === document.location.origin) {
      return composite.same_origin ? url.href : undefined;
    }

    return composite.remote ? url.hash : undefined;

  }
  catch (err) {
    console.error(err);
  }

  return undefined;

};
