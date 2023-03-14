/**
 * this is our main file for building and generating API types.
 * 
 * because we're using a custom element, we have a class that inherits from 
 * HTMLElement. that's fine, but it means the build output can't be used in 
 * a node environment (for testing, for example) without a shim.
 * 
 * we may add some separate build targets that exclude the html 
 * element for that purpose in the future.
 */

export { TREB, TREBGlobal } from './custom-element/treb-global';

// import for side effects
import './custom-element/treb-spreadsheet-element';

