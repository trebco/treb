
import * as Matrix from './matrix';
import type { matrix } from './matrix';

export class Givens {

  public constructor(
    private j_matrix = Matrix.Zero(2, 2), 
    private q_matrix = Matrix.Zero(1, 1), 
    private r_matrix = Matrix.Zero(1, 1)) {
    // ...
  }

  public Inverse(mat: matrix): matrix {
    if (mat.n !== mat.m) {
      throw new Error('matrix must be square');
    }

    const identity = Matrix.Identity(mat.m);
    this.Decompose(mat);
    return this.Solve(identity);
  }

  public Solve( mat: matrix ): matrix {

    const qtmat_matrix = Matrix.Multiply(Matrix.Transpose(this.q_matrix), mat);
    const n = this.r_matrix.n;
    const s_matrix = Matrix.Zero(1, n);
    
    for (let i = n - 1; i >= 0; i-- ) {
      s_matrix.data[0][i] = qtmat_matrix.data[i][0];
      for ( let j = i + 1; j < n; j++ ) {
        s_matrix.data[0][i] = s_matrix.data[0][i] - s_matrix.data[0][j] * this.r_matrix.data[i][j];
      }
      s_matrix.data[0][i] = s_matrix.data[0][i] / this.r_matrix.data[i][i];
    }

    return s_matrix;

  }

  public Decompose( mat: matrix ): void {

    const m = mat.m;
    let n = mat.n;

    if ( m == n ) {
      n--;
    }
    else if ( m < n ) {
      n = m - 1;
    }

    this.q_matrix = Matrix.Identity(m);
    this.r_matrix = mat;

    for ( let j = 0; j < n; j++ ) {
      for ( let i = j + 1; i < m; i++ ) {
        this.GivensRotation( this.r_matrix.data[j][j], this.r_matrix.data[i][j] );
        this.PreMultiplyGivens( this.r_matrix, j, i );
        this.PreMultiplyGivens( this.q_matrix, j, i );
      }
    }

    this.q_matrix = Matrix.Transpose(this.q_matrix);

  }

  private GivensRotation( a: number, b: number ): void {

    let t = 0;
    let s = 0;
    let c = 0;

    if (b === 0) {
      c = (a >=0) ? 1 : -1;
      s = 0; 
    }
    else if (a === 0) {
      c = 0;
      s = (b >=0) ? -1 : 1;
    }
    else if (Math.abs(b) > Math.abs(a)) {
      t = a / b;
      s = -1 / Math.sqrt(1 + t * t);
      c = -s * t;
    }
    else {
      t = b / a;
      c = 1 / Math.sqrt( 1 + t * t);
      s = -c * t;
    }

    this.j_matrix.data[0][0] =  c; 
    this.j_matrix.data[0][1] = -s;
		
    this.j_matrix.data[1][0] =  s; 
    this.j_matrix.data[1][1] =  c;

  }

  private PreMultiplyGivens( mat: matrix, i: number, j: number ): void {
    for (let c = 0; c < mat.n; c++ ) {
      const tmp = mat.data[i][c] * this.j_matrix.data[0][0] + mat.data[j][c] * this.j_matrix.data[0][1];
      mat.data[j][c] = mat.data[i][c] * this.j_matrix.data[1][0] + mat.data[j][c] * this.j_matrix.data[1][1];
      mat.data[i][c] = tmp;
    }
  }

}

