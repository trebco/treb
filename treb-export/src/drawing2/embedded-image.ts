/**
 * This file is part of TREB.
 * Copyright 2022 trebco, llc.
 * info@treb.app
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
