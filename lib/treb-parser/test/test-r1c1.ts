
import { Parser, UnitBinary } from '../';
// import { ConvertML, ConvertUSVolume } from './us-volume';
// import { USVolumeConversion } from './us-volume';
// import { Calculator } from './calc';

console.info('test r1c1');

const parser = new Parser();
parser.flags.r1c1 = true;

let result = parser.Parse('=2 + glern!R3');
console.info({expr: result.expression});

result = parser.Parse('=2 + Zork!R[0]C[-1]');
console.info({expr: result.expression});
