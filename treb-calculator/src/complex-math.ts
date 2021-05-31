
import { Complex, IsComplex, UnionValue, ValueType } from 'treb-base-types/src';

export const PolarToRectangular = (a: {r: number, theta: number}): Complex => {

  const {r, theta} = a;

  const real = r * Math.cos(theta);
  const imaginary = r * Math.sin(theta);

  // console.info("P2R",  `r ${r} theta (o) ${theta * 57.29577951308232}`, '->', `${real||0}${imaginary < 0 ? '' : '+'}${imaginary}i`);

  return { real, imaginary }
};

export const RectangularToPolar = (value: Complex): {r: number, theta: number} => {

  const r = Math.sqrt(value.real * value.real + value.imaginary * value.imaginary);
  const theta = Math.atan2(value.imaginary, value.real);

  // console.info("R2P", `${value.real||0}${value.imaginary < 0 ? '' : '+'}${value.imaginary}i`, '->', `r ${r} theta (o) ${theta * 57.29577951308232}`);

  return { r, theta };
};

export const Multiply = (a: Complex, b: Complex): Complex => {
  return {
    real: (a.real * b.real) - (a.imaginary * b.imaginary),
    imaginary: a.real * b.imaginary + a.imaginary * b.real,
  }
};

export const Divide = (a: Complex, b: Complex): Complex => {

  const conjugate = { real: b.real, imaginary: -b.imaginary };

  const numerator = Multiply(a, conjugate);
  const denominator = Multiply(b, conjugate);

  /*
  if (denominator.imaginary) {
    throw new Error('invalid denom!');
  }
  */

  return {
    real: numerator.real / denominator.real,
    imaginary: numerator.imaginary / denominator.real, 
  };

};

export const Exp = (value: Complex): Complex => {

  const a = value.real || 0;
  const b = value.imaginary || 0;

  // e^(a + bi) = e^a * e^ib = e^a * (cos b - i sin b)

  return Multiply(
    { real: Math.exp(a), imaginary: 0, }, 
    { real: Math.cos(b), imaginary: Math.sin(b), },
  );

};

/**
 * from polar form, the principal value is
 * Log z = ln r + iθ
 */
export const Log = (value: Complex): Complex => {
  const polar = RectangularToPolar(value);
  return {
    real: Math.log(polar.r),
    imaginary: polar.theta,
  };
}

/**
 * returns a^b where a and b are (possibly) complex
 */
export const Power = (a: Complex, b: Complex): Complex => {

  if (!b.imaginary) {

    // b is real, essentially

    const polar = RectangularToPolar(a);
    const value = PolarToRectangular({
      r: Math.pow(polar.r, b.real), 
      theta: polar.theta * b.real,
    });

    return value;

  }
  else {

    // in this case, 
    // (a + bi)^(c + di) = exp((c + di) * Log(a + bi))

    return Exp(Multiply(b, Log(a)));

  }


};

