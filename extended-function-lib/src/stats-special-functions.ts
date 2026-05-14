
const ERF_T = [9.60497373987051638749e0, 9.00260197203842689217e1, 2.23200534594684319226e3, 7.00332514112805075473e3, 5.55923013010394962768e4];
const ERF_U = [1.0, 3.35617141647503099647e1, 5.21357949780152679795e2, 4.59432382970980127987e3, 2.26290000613890934246e4, 4.94730910816827513331e4];
const ERF_P = [2.46196981473530512524e-10, 5.64189564831068821977e-1, 7.46321056442269912687e0, 4.86371970985681366614e1, 1.96520832956077098242e2, 5.26445194995477358631e2, 9.34528527171957607540e2, 1.02755188689515710272e3, 5.57535335369399327526e2];
const ERF_Q = [1.0, 1.32281951154744992508e1, 8.67072140885989742329e1, 3.54937778887819891062e2, 9.75708501743205489753e2, 1.82390916687909736289e3, 2.24633760818710981792e3, 1.65666309194161350182e3, 5.57535340817727401220e2];
const ERF_R = [5.64189583547755073984e-1, 1.27536670759978104416e0, 5.01905042251180477414e0, 6.16021097993053585195e0, 7.40974269950448939160e0, 2.97886665372100240670e0];
const ERF_S = [1.0, 2.26052863220117276590e0, 9.39603524938001434673e0, 1.20489539808096656605e1, 1.70814450747565897222e1, 9.60896088305422468066e0, 3.36907645100081462098e0];

function Polevl(x: number, coef: number[]): number {
  let result = coef[0];
  for (let i = 1; i < coef.length; i++) result = result * x + coef[i];
  return result;
}

function Erf(x: number): number {
  if (x === 0) return 0;
  const sign = Math.sign(x);
  const a = Math.abs(x);
  if (a < 0.5) return sign * a * Polevl(a * a, ERF_T) / Polevl(a * a, ERF_U);
  if (a < 4) return sign * (1 - Math.exp(-a * a) * Polevl(a, ERF_P) / Polevl(a, ERF_Q));
  const inv_a2 = 1 / (a * a);
  return sign * (1 - Math.exp(-a * a) * (Polevl(inv_a2, ERF_R) / Polevl(inv_a2, ERF_S)) / a);
}

export function NormalCDF(x: number, mean: number, stdev: number): number {
  return 0.5 * (1 + Erf((x - mean) / (stdev * Math.SQRT2)));
}

export function NormalInv(p: number): number {
  if (p <= 0) return -Infinity;
  if (p >= 1) return Infinity;
  if (p === 0.5) return 0;
  const sign = p < 0.5 ? -1 : 1;
  const q = p < 0.5 ? p : 1 - p;
  const t = Math.sqrt(-2 * Math.log(q));
  let x = sign * (t - (2.515517 + 0.802853 * t + 0.010328 * t * t)
    / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t));
  for (let i = 0; i < 10; i++) {
    const err = 0.5 * (1 + Erf(x / Math.SQRT2)) - p;
    const pdf = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
    if (pdf < 1e-300) break;
    const delta = err / pdf;
    x -= delta;
    if (Math.abs(delta) < 1e-15 * Math.abs(x)) break;
  }
  return x;
}

const LANCZOS_G = 7;
const LANCZOS_COEFFICIENTS = [
  0.99999999999980993,
  676.5203681218851,
  -1259.1392167224028,
  771.32342877765313,
  -176.61502916214059,
  12.507343278686905,
  -0.13857109526572012,
  9.9843695780195716e-6,
  1.5056327351493116e-7,
];

export function Lgamma(x: number): number {
  if (x <= 0 && x === Math.floor(x)) return Infinity;
  if (x < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - Lgamma(1 - x);
  }
  x -= 1;
  let a = LANCZOS_COEFFICIENTS[0];
  for (let i = 1; i < LANCZOS_COEFFICIENTS.length; i++) {
    a += LANCZOS_COEFFICIENTS[i] / (x + i);
  }
  const t = x + LANCZOS_G + 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function GammaPSeries(a: number, x: number): number {
  let term = 1 / a;
  let sum = term;
  for (let n = 1; n < 200; n++) {
    term *= x / (a + n);
    sum += term;
    if (Math.abs(term) < Math.abs(sum) * 1e-15) break;
  }
  return sum * Math.exp(-x + a * Math.log(x) - Lgamma(a));
}

function GammaPContinuedFraction(a: number, x: number): number {
  const TINY = 1e-30;
  let b = x + 1 - a;
  let c = 1 / TINY;
  let d = 1 / b;
  let h = d;

  for (let i = 1; i < 200; i++) {
    const a_n = -i * (i - a);
    b += 2;
    d = a_n * d + b;
    if (Math.abs(d) < TINY) d = TINY;
    c = b + a_n / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }

  return 1 - h * Math.exp(-x + a * Math.log(x) - Lgamma(a));
}

export function RegularizedGammaP(a: number, x: number): number {
  if (x < 0 || a <= 0) return 0;
  if (x === 0) return 0;
  if (x < a + 1) return GammaPSeries(a, x);
  return GammaPContinuedFraction(a, x);
}

function BetaCFraction(a: number, b: number, x: number): number {
  const TINY = 1e-30;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 / (1 - qab * x / qap);
  if (Math.abs(d) < TINY) d = TINY;
  let h = d;

  for (let m = 1; m < 200; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    h *= d * c;

    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < TINY) d = TINY;
    c = 1 + aa / c;
    if (Math.abs(c) < TINY) c = TINY;
    d = 1 / d;
    const delta = d * c;
    h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return h;
}

export function RegularizedBetaI(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const log_prefix = Lgamma(a + b) - Lgamma(a) - Lgamma(b)
    + a * Math.log(x) + b * Math.log(1 - x);
  if (x < (a + 1) / (a + b + 2)) {
    return Math.exp(log_prefix) * BetaCFraction(a, b, x) / a;
  }
  return 1 - Math.exp(log_prefix) * BetaCFraction(b, a, 1 - x) / b;
}
