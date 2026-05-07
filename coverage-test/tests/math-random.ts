
import { AddTests, type EvaluateResultType } from '@util';

AddTests('RAND', [
  {
    type: 'custom', expression: '=RAND()', count: 1000, validate: (results: EvaluateResultType[]) => {
      for (const r of results) {
        if (typeof r !== 'number' || r <= 0 || r >= 1) return false;
      }
      return true;
    }
  }
]);

AddTests('RANDBETWEEN', [
  {
    type: 'custom', expression: '=RANDBETWEEN(1,10)', count: 1000, validate: (results: EvaluateResultType[]) => {
      for (const r of results) {
        if (typeof r !== 'number' || r < 1 || r > 10 || r !== Math.floor(r)) return false;
      }
      return true;
    }
  },
  {
    type: 'custom', expression: '=RANDBETWEEN(-5,5)', count: 100, validate: (results: EvaluateResultType[]) => {
      for (const r of results) {
        if (typeof r !== 'number' || r < -5 || r > 5 || r !== Math.floor(r)) return false;
      }
      return true;
    }
  },
]);

AddTests('RANDARRAY', [
  {
    type: 'custom', expression: '=RANDARRAY(3,2)', count: 1, validate: (results: EvaluateResultType[]) => {
      const r = results[0];
      if (!Array.isArray(r)) return false;
      if (r.length !== 3) return false;
      for (const row of r) {
        if (!Array.isArray(row) || row.length !== 2) return false;
        for (const val of row) {
          if (typeof val !== 'number' || val <= 0 || val >= 1) return false;
        }
      }
      return true;
    }
  },
  {
    type: 'custom', expression: '=RANDARRAY(2,2,1,10,TRUE)', count: 10, validate: (results: EvaluateResultType[]) => {
      for (const r of results) {
        if (!Array.isArray(r)) return false;
        for (const row of (r as number[][])) {
          for (const val of row) {
            if (typeof val !== 'number' || val < 1 || val > 10 || val !== Math.floor(val)) return false;
          }
        }
      }
      return true;
    }
  },
]);
