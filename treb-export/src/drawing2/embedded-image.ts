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

export interface ImageOptions {
  // ...
  data?: string;
  encoding?: 'base64';
  mimetype?: string;
}

export class EmbeddedImage {
  
  public static next_image_index = 1;
  public extension = '';

  constructor(public options: ImageOptions, public index = EmbeddedImage.next_image_index++) {

    switch (options.mimetype) {

      case 'svg+xml':
        this.extension = 'svg';
        break;
 
      case 'image/png':
        this.extension = 'png';
        break;

      case 'jpg':
        this.extension = 'jpeg';
        break;

      case 'svg':
      case 'png':
      case 'jpeg':
      case 'gif':
        this.extension = options.mimetype;
        break;

      //case 'webp':
      //  this.extension = 'bin';
      //  break;

      default:
        console.warn('unhandled mime type', options.mimetype);
        break;

    }
    
  }



}
