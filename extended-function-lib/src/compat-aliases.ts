
// alias pairs: [alias_name, target_function_name]. use these for functions
// that are identical except for the name, e.g. the older 'GAMMADIST' maps to
// the modern 'GAMMA.DIST'. the consumer registers these after functions.

const aliases: [string, string][] = [
  ['BETAINV', 'BETA.INV'],
  ['BINOMDIST', 'BINOM.DIST'],
  ['CHIDIST', 'CHISQ.DIST.RT'],
  ['CHIINV', 'CHISQ.INV.RT'],
  ['CHITEST', 'CHISQ.TEST'],
  ['CRITBINOM', 'BINOM.INV'],
  ['FDIST', 'F.DIST.RT'],
  ['FINV', 'F.INV.RT'],
  ['FTEST', 'F.TEST'],
  ['GAMMADIST', 'GAMMA.DIST'],
  ['GAMMAINV', 'GAMMA.INV'],
  ['LOGINV', 'LOGNORM.INV'],
  ['NORMINV', 'NORM.INV'],
  ['MODE', 'MODE.SNGL'],
  ['PERCENTRANK', 'PERCENTRANK.INC'],
  ['POISSON', 'POISSON.DIST'],
  ['STDEVP', 'STDEV.P'],
  ['TINV', 'T.INV.2T'],
  ['TTEST', 'T.TEST'],
  ['VARP', 'VAR.P'],
  ['WEIBULL', 'WEIBULL.DIST'],
  ['ZTEST', 'Z.TEST'],
  ['CONFIDENCE', 'CONFIDENCE.NORM'],
  ['EXPONDIST', 'EXPON.DIST'],
];

export default aliases;
