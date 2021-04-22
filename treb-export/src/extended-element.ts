
import { Element } from 'elementtree';

/**
 * we make use of the _children array on element, rightly or wrongly,
 * so we need to expose it.
 */
export interface ExtendedElement extends Element{
  _children: Element[];
}
