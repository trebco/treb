
import { AddTests } from '@util';

AddTests('IMSIN', [
  { type: 'expect', expression: '=IMSIN("0")', expected: '0' },
  { type: 'expect', expression: '=IMSIN("1")', expected: '0.841470984807897' },
]);

AddTests('IMCOS', [
  { type: 'expect', expression: '=IMCOS("0")', expected: '1' },
  { type: 'expect', expression: '=IMCOS("1")', expected: '0.54030230586814' },
]);

AddTests('IMTAN', [
  { type: 'expect', expression: '=IMTAN("0")', expected: '0' },
  { type: 'expect', expression: '=IMTAN("1")', expected: '1.5574077246549' },
]);

AddTests('IMCOT', [
  { type: 'expect', expression: '=IMCOT("1")', expected: '0.642092615934331' },
]);

AddTests('IMCSC', [
  { type: 'expect', expression: '=IMCSC("1")', expected: '1.18839510577812' },
]);

AddTests('IMSEC', [
  { type: 'expect', expression: '=IMSEC("0")', expected: '1' },
  { type: 'expect', expression: '=IMSEC("1")', expected: '1.85081571768093' },
]);

AddTests('IMCSCH', [
  { type: 'expect', expression: '=IMCSCH("1")', expected: '0.850918128239322' },
]);

AddTests('IMSECH', [
  { type: 'expect', expression: '=IMSECH("0")', expected: '1' },
  { type: 'expect', expression: '=IMSECH("1")', expected: '0.648054273663885' },
]);
