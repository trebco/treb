
import UZip from 'uzip';
import Base64JS from 'base64-js';

export class ZipWrapper {

  public records: UZip.UZIPFiles;
  public text: Map<string, string> = new Map();

  public constructor(buffer: ArrayBuffer) {
    this.records = UZip.parse(buffer);
  }

  /**
   * check if entry exists
   */
  public Has(path: string) {
    return this.text.has(path) || !!this.records?.[path];
  }

  /**
   * nondestructive
   */
  public ArrayBuffer() {
    
    const records: Record<string, Uint8Array> = {};
    if (this.records) {
      for (const [key, value] of Object.entries(this.records)) {
        records[key] = new Uint8Array(value);
      }
    }

    const encoder = new TextEncoder();
    for (const [key, value] of this.text.entries()) {
      records[key] = encoder.encode(value);
    }

    return UZip.encode(records);

  }

  /**
   * set a binary file. set this directly in the records table, 
   * instead of the text table.
   */
  public SetBinary(path: string, data: string, encoding?: 'base64'|'binary') {

    if (encoding === 'base64') {
      const bytes = Base64JS.toByteArray(data);
      this.records[path] = bytes;
    }
    else {
      throw new Error('unsupported encoding: ' + encoding);
    }

  }

  public Set(path: string, text: string) {

    this.text.set(path, text);
    if (!!this.records[path]) {
      delete this.records[path];
    }
  }

  public GetBinary(path: string) {
    const data = this.records[path];
    if (data) {
      return new Uint8Array(data);
    }
    throw new Error('path not in records: ' + path);
  }

  public Get(path: string) {

    let text = this.text.get(path);

    if (text) {
      return text;
    }

    const data = this.records[path];
    if (data) {
      text = new TextDecoder().decode(data);
      this.text.set(path, text);
      delete this.records[path];
      return text;
    }

    console.info(this);

    throw new Error('path not in zip file: ' + path);

  }

}
