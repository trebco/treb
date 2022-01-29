
import { CellValue, DimensionedQuantity, IsDimensionedQuantity, ValueType } from 'treb-base-types';
import { NumberFormat, NumberFormatCache } from 'treb-format';
import { UnitIdentifier, UnitLiteralNumber } from 'treb-parser';

import { USVolumeConverter } from './us-volume';
import { Calculator as DQCalculator } from './calc';
import { UnitLiteral } from 'lib/treb-parser/src';

const calc = new DQCalculator();

export const Init = () => {

  const metric_format = new NumberFormat('#');
  metric_format.transform_value = (value: CellValue): CellValue => {
    if (IsDimensionedQuantity(value)) {

      const check = calc.Convert({
        type: 'dimensioned',
        expression: { type: 'literal', value: value.value, id: 0, position: 0, },
        unit: { type: 'identifier', name: value.unit, id: 0, position: 0, },
        id: 0,
      });

      return {
        value: (check.expression as UnitLiteralNumber).value,
        unit: 'ml',
      }

    }
    return value;
  };
  (NumberFormatCache as any).cache['Metric Volume'] = metric_format;

  const usv_format = new NumberFormat('? ##/##');
  usv_format.transform_value = (value: CellValue): CellValue => {
    if (IsDimensionedQuantity(value)) {

      const check = calc.Convert({
        type: 'dimensioned',
        expression: { type: 'literal', value: value.value, id: 0, position: 0, },
        unit: { type: 'identifier', name: value.unit, id: 0, position: 0, },
        id: 0,
      });
      
      const usv = USVolumeConverter.ConvertML((check.expression as UnitLiteralNumber).value);
      const str = USVolumeConverter.Render(usv);
      return str;

    }
    return value;
  };

  (NumberFormatCache as any).cache['US Volume'] = usv_format;
  
};

