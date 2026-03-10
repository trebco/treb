


import { XMLParser } from 'fast-xml-parser';
import * as OOXML from 'ooxml-types';

export const ooxml_parser = new XMLParser({
  attributesGroupName: '$attributes',
  ignoreAttributes: false,
  parseAttributeValue: true,
  attributeNamePrefix: '',
  removeNSPrefix: true,
  textNodeName: '$text',
  cdataPropName: '$cdata',
  parseTagValue: false,
  alwaysCreateTextNode: true,
});

export function EnsureArray<T>(tag?: OOXML.OneOrMany<T>) {
  if (Array.isArray(tag)) {
    return tag;
  }
  if (tag === undefined ) { 
    return []; 
  }
  return [tag];
}

export function IterateTags<T>(root: OOXML.OneOrMany<T>|undefined, fn: (tag: T) => false|void) {
  for (const element of EnsureArray(root)) { 
    const test = fn(element);
    if (test === false) {
      break;
    }
  }
}

export function MapTags<K, T>(root: OOXML.OneOrMany<T>|undefined, fn: (tag: T) => K) {
  const arr: K[] = [];
  for (const element of EnsureArray(root)) { arr.push(fn(element)); }
  return arr;
}

export function FirstTag<T>(root: OOXML.OneOrMany<T>) {
  return EnsureArray(root)[0];
}

