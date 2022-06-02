
export type matrix = {
  m: number,
  n: number,
  data: number[][],
};

export const Zero = (m: number, n: number): matrix => {
  const data: number[][] = [];
  for (let i = 0; i< m; i++) {
    const row: number[] = [];
    for (let j = 0; j < n; j++) {
      row.push(0);
    }
    data.push(row);
  }
  return { m, n, data, };
};

export const Identity = (n: number): matrix => {
  const mat = Zero(n, n);
  for (let i = 0; i < n; i++) {
    mat.data[i][i] = 1;
  }
  return mat;
};

export const FromData = (data: number[][]): matrix => {
  data = JSON.parse(JSON.stringify(data));
  return {
    m: data.length,
    n: data[0].length,
    data,
  };
};

export const Transpose = (mat: matrix): matrix => {
  const data: number[][] = [];
  for (let i = 0; i< mat.n; i++) {
    const row: number[] = [];
    for (let j = 0; j < mat.m; j++) {
      row.push(mat.data[j][i]);
    }
    data.push(row);
  }
  return { m: mat.n, n: mat.m, data, };
};

export const Multiply = (a: matrix, b: matrix): matrix => {

  if (a.n !== b.m) {
    throw new Error('invalid multiply');
  }

  const p = Zero(a.m, b.n);

  for (let i = 0; i < a.m; i++) {
    for (let j = 0; j < b.n; j++) {
      let value = 0;
      for (let k = 0; k < b.m; k++) {
        value += a.data[i][k] * b.data[k][j];
      }
      p.data[i][j] = value;
    }
  }

  return p;
};
