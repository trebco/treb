
import { Parser, UnitLiteralNumber, UnitLiteralString } from '../';
// import { ConvertML, ConvertUSVolume } from './us-volume';
import { USVolumeConversion } from './us-volume';
import { Calculator } from './calc';

console.info('test fractions');

const parser = new Parser();
parser.flags.fractions = true;
parser.flags.dimensioned_quantities = true;
parser.flags.spreadsheet_semantics = false;

const calculator = new Calculator();

const Test = (s: string) => {
  const result = parser.Parse(s);
  if (result.expression) {
    console.info('r', parser.Render(result.expression));
    console.info(result.expression);

    /*
    if (result.expression.type === 'dimensioned') {
      const converted = calculator.Convert(result.expression);
      console.info("converted");
      console.info(JSON.stringify(converted, undefined, 2));
    } 
    */
    const calc_result = calculator.Calculate(result.expression);
    console.info('\ncalc result');
    console.info({calc_result});

    if (calc_result.type === 'dimensioned') {
      if (calc_result.unit.name !== 'ml') {
        console.info("ERR unit?", {calc_result});
      }
      else {

        const err = 0.035;

        const ml1 = (calc_result.expression as UnitLiteralNumber).value;
        const ml2 = Math.round(USVolumeConversion.ConvertUSVolume(
          USVolumeConversion.ConvertML((calc_result.expression as UnitLiteralNumber).value, err)));

        // less-smart strategy
        const ml3 = Math.round(USVolumeConversion.ConvertUSVolume(
          USVolumeConversion.ConvertML((calc_result.expression as UnitLiteralNumber).value, err, 0)));
  
        console.info(
          USVolumeConversion.ConvertML((calc_result.expression as UnitLiteralNumber).value, err),
          ml2,
          ml1,
          'err: ' + (100 * Math.abs(ml2-ml1) / ml1).toFixed(2) + '%',
          `(${ml3}, err: ${(100 * Math.abs(ml3-ml1) / ml1).toFixed(2) + '%'})`
          );

          const s = USVolumeConversion.Render(USVolumeConversion.ConvertML((calc_result.expression as UnitLiteralNumber).value, err));
          const s2 = USVolumeConversion.Render(USVolumeConversion.ConvertML((calc_result.expression as UnitLiteralNumber).value, err, 0));
          console.info(`${s} [${s2}]`);

      }
    }

  }
  else {
    console.info('*ERR');
    console.info(result);
  }
};

/*
Test('1/2');
Test('1/2C');
Test('0 1/2C');
*/
Test('1/4C / 2');

/*
const start = 300;
const volume = ConvertML(start);
const ml = ConvertUSVolume(volume);
console.info({start, volume, ml, err: Math.abs(start-ml)/start});
*/

// Test('2 1/3C + 1tsp');
// Test('2c * (1/3)');
// Test('1/2c + 3tbsp');

/*
const start = 157.73 * 5/6;
const volume = ConvertML(start);
const ml = ConvertUSVolume(volume);
console.info({start, volume, ml, err: Math.abs(start-ml)/start});
*/

// console.info(parser.Parse('10 fl.ounce').expression);

/*
for (const str of [
  'floz',
  'fl oz',
  'fl.oz',
  'fl. oz',
  'fluid oz',
  'fluid ounces',
  'fl ounces',
  'fl. ounces',
  'fl. ounce',
  'cc',
  'ccs',
  'cm3',
  'cm^3',
  'cubic cm',
  'cubic cms',
  'cubic centimeter',
  'cubic centimeters',
  'ml',
  'deciliters',
  'tbl',
  'Ts',
  'ts',
  'tsp',
  'tsp.',
  'tsps',
  'teasponns',
  'teaspoons',
  'oz',
  'g', 
  'ounce',
  'ounces',
  'lb.',
  'pound',
  'pounds',
  'lbs.',
]) {

  console.info(str + ':', calculator.MapUnit(str));

}
*/






