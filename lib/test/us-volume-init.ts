
import { CellValue, DimensionedQuantity, IsDimensionedQuantity, ValueType } from 'treb-base-types';
import { NumberFormat, NumberFormatCache } from 'treb-format';
import { UnitIdentifier, UnitLiteralNumber } from 'treb-parser';

import { USVolumeConverter } from './us-volume';
import { Calculator as DQCalculator } from './calc';
import { UnitLiteral } from 'lib/treb-parser/src';

export const calculator = new DQCalculator();

export const Init = () => {

  // for number formats, in this case we want a couple of different 
  // combinations. because it's a finite (and relatively small) number, 
  // we can just create one for each case 

  // ---- case 1: ml/g ---------------------------------------------------------

  const metric_format = new NumberFormat('#,##0');
  metric_format.transform_value = (value: CellValue): CellValue => {
    if (IsDimensionedQuantity(value)) {
      const check = calculator.ConvertValue(value);
      if (!check) {
        // return '(unknown unit)';
        return value;
      }
      return check;
    }
    return value;
  };
  (NumberFormatCache as any).cache['Metric'] = metric_format;

  // ---- case 2: cup/oz -------------------------------------------------------

  const base_format = new NumberFormat('#.#');
  base_format.magic_decimal = true;

  const cup_oz = new NumberFormat('? ##/##');
  cup_oz.transform_value = (value: CellValue): CellValue => {
    if (IsDimensionedQuantity(value)) {
      const check = calculator.ConvertValue(value);
      if (!check) {
        // return '(unknown unit)';
        return value;
      }

      if (check.unit === 'ml') {
        const usv = USVolumeConverter.ConvertML(check.value);
        const str = USVolumeConverter.Render(usv);
        return str;
      }
      else if (check.unit === 'g') {
        const imperial = USVolumeConverter.ConvertG(check.value);
        const str: string[] = [];
        if (imperial.lb) {
          str.push(base_format.Format(imperial.lb), 'lb');
        }
        if (imperial.oz) {
          str.push(base_format.Format(imperial.oz), 'oz');
        }
        return str.length ? str.join(' ') : '0';
      }

      return check;

    }
    return value;
  };
  (NumberFormatCache as any).cache['US/Imperial'] = cup_oz;

  // ---- case 3: cup/g --------------------------------------------------------

  const cup_gram = new NumberFormat('? ##/##');
  cup_gram.transform_value = (value: CellValue): CellValue => {
    if (IsDimensionedQuantity(value)) {
      const check = calculator.ConvertValue(value);
      if (!check) {
        // return '(unknown unit)';
        return value;
      }

      if (check.unit === 'ml') {
        const usv = USVolumeConverter.ConvertML(check.value);
        const str = USVolumeConverter.Render(usv);
        return str;
      }
      else if (check.unit === 'g') {
        return check;
      }

      return check;

    }
    return value;
  };
  (NumberFormatCache as any).cache['US/g'] = cup_gram;

};

