
import { Parser } from '../';

console.info('test fractions');

const parser = new Parser();
parser.flags.fractions = true;
parser.flags.dimensioned_quantities = true;

const Test = (s: string) => {
  const result = parser.Parse(s);
  if (result.expression) {
    console.info('r', parser.Render(result.expression));
  }
  else {
    console.info('*ERR');
    console.info(result);
  }
};

Test('3');
Test('3.5');
Test('-5');
Test('-.92');

console.info('---');

Test('2 * -2 1/2');









