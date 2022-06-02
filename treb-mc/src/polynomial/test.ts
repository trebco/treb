
import { Transpose, Multiply, type matrix, Zero, FromData, Identity } from './matrix';
import { Polynomial } from './polynomial';
import { RPoly } from './rpoly';

/*
const mat = CreateMatrix(2,3);
console.info(mat);
console.info('');

const A = FromData([
  [1, 2, 3],
  [4, 5, 6],
]);

console.info(A);

const B = FromData([
  [ 7,  8],
  [ 9, 10],
  [11, 12],
]);

console.info(B);
console.info('');

const A1 = Transpose(A);
console.info(A1);
console.info('');

const C = Multiply(A, B);
console.info(C);
console.info('');

const T = Transpose(C);
console.info(T);

const I = IdentityMatrix(4);
console.info(I);
*/

/*
const y = [2023, 
  2024, 
  2025, 
  2026, 
  2027, 
  2028, 
  2029, 
  2030, 
  2031, 
  2032, 
  2033, 
  2034, 
  2035, 
  2036, 
  2037, 
  2038, 
  2039, 
  2040, 
  2041, 
  ];
const x = [0.058, 
  0.074, 
  0.112, 
  0.12, 
  0.166, 
  0.2, 
  0.206, 
  0.238, 
  0.242, 
  0.272, 
  0.34, 
  0.378, 
  0.362, 
  0.338, 
  0.382, 
  0.38, 
  0.414, 
  0.442, 
  0.462, 
  ];

const result = Polynomial.Fit(x, y, 2);

console.info(result);
*/

const intercept_offset = -.5;
const min = 150000;
const max = 245000;
const coeff = [0.543243010490975, 	1.61629691952281E-05, 	-1.27028484992019E-10, 	2.25451724481817E-16, 	0, ];

coeff[0] -= .8; // offset intercept

/*
const degree = 3;
const zeror: number[] = [];
const zeroi: number[] = [];
const op = [
  2.2545172448181678e-16,
  -1.2702848499201905e-10,
  1.6162969195228104e-05,
  0.043243010490974676,
];

const result = new RPoly().findRoots(op, degree, zeror, zeroi);

console.info({result}, zeror, zeroi);
*/

const rr = Polynomial.Roots(coeff);
console.info('rr', rr);

