
import { MDParser } from '../src/md-parser';

const text = '_This is CNN: ~Karl~ someone else_';

const tokens = MDParser.instance.Parse(text);

console.info(tokens);
console.info(MDParser.instance.HTML(tokens));

