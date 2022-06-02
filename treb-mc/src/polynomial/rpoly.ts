/* eslint-disable no-unused-labels */

/**
 * based on 
 * https://github.com/simbody/simbody/blob/master/SimTKcommon/Polynomial/src/rpoly.cpp
 * 
 * not sure why it uses a class instance, because there's no state
 * outside of the findRoots routine. 
 * 
 * source comment:
 * 
 *      rpoly.cpp -- Jenkins-Traub real polynomial root finder.
 *
 *      Written by C. Bond, with minor changes by Peter Eastman.
 *      This file is in the public domain.
 *
 *      Translation of TOMS493 from FORTRAN to C. This
 *      implementation of Jenkins-Traub partially adapts
 *      the original code to a C environment by restruction
 *      many of the 'goto' controls to better fit a block
 *      structured form. It also eliminates the global memory
 *      allocation in favor of local, dynamic memory management.
 *
 *      The calling conventions are slightly modified to return
 *      the number of roots found as the function value.
 *
 *      INPUT:
 *      op - vector of coefficients in order of
 *              decreasing powers.
 *      degree - integer degree of polynomial
 *
 *      OUTPUT:
 *      zeror,zeroi - output vectors of the
 *              real and imaginary parts of the zeros.
 *
 *      RETURN:
 *      returnval:   -1 if leading coefficient is zero, otherwise
 *                  number of roots found. 
 */

export class RPoly {

  public eta = 0;
  public are = 0;
  public mre = 0;

  public n = 0;
  public nn = 0;
  public nmi = 0;
  public zerok = false;

  public p: number[] = [];
  public qp: number[] = [];
  public k: number[] = [];
  public qk: number[] = [];
  public svk: number[] = [];

  public sr = 0;
  public si = 0;
  public u = 0;
  public v = 0;
  public a = 0;
  public b = 0;
  public c = 0;
  public d = 0
  public a1 = 0;
  public a2 = 0;

  public a3 = 0;
  public a6 = 0;
  public a7 = 0;
  public e = 0;
  public f = 0;
  public g = 0;
  public h = 0;
  public szr = 0;
  public szi = 0;
  public lzr = 0;
  public lzi = 0;

  public findRoots(op: number[], degree: number, zeror: number[], zeroi: number[])   {
    
    let t = 0;
    let aa = 0;
    let bb = 0;
    let cc = 0;
    let temp: number[] = []; // * was pointer
    let factor = 0;
    let rot = 0;

    let pt: number[] = []; // * was pointer

    let lo = 0, max = 0, min = 0, xx = 0, yy = 0, cosr = 0, sinr = 0, xxx = 0, x = 0, sc = 0, bnd = 0;
    let xm = 0, ff = 0, df = 0, dx = 0, infin = 0, smalno = 0, base = 0;
    let cnt = 0, nz = 0, i = 0, j = 0, jj = 0, l = 0, nm1 = 0, zerok = false; // shadows class field?

  /*  The following statements set machine constants. */
      base = 2.0;

      /*
      eta = std::numeric_limits<T>::epsilon();
      infin = std::numeric_limits<T>::max();
      smalno = std::numeric_limits<T>::min();
    */

    // we could probably set more reasonable values

    // this.eta = 1e-30; // ?
    // infin = Number.MAX_VALUE;
    // smalno = Number.MIN_VALUE;

    this.eta = 2.22e-16;
    infin = 3.4e38;
    smalno = 1.2e-38;

    this.are = this.eta;
    this.mre = this.eta;
      lo = smalno/this.eta;

  /*  Initialization of constants for shift rotation. */        
      xx = Math.sqrt(0.5);
      yy = -xx;
      rot =  94.0;
      rot *= 0.017453293;
      cosr = Math.cos(rot);
      sinr = Math.sin(rot);
      this.n = degree;
  
  /*  Algorithm fails if the leading coefficient is zero (or if degree==0). */
      if (this.n < 1 || op[0] == 0.0) 
          return -1;
  
  /*  Remove the zeros at the origin, if any. */
      while (op[this.n] == 0.0) {
          j = degree - this.n;
          zeror[j] = 0.0;
          zeroi[j] = 0.0;
          this.n--;
      }
  
      // sherm 20130410: If all coefficients but the leading one were zero, then
      // all solutions are zero; should be a successful (if boring) return.
      if (this.n === 0) 
          return degree;
  
  /*
   *  Allocate memory here
   */
      temp = []; // new T [degree+1];
      pt = []; //  = new T [degree+1];
      this.p = []; //  = new T [degree+1];
      this.qp = []; //  = new T [degree+1];
      this.k = []; //  = new T [degree+1];
      this.qk = []; //  = new T [degree+1];
      this.svk = []; //  = new T [degree+1];

  /*  Make a copy of the coefficients. */
      for (i=0;i<=this.n;i++)
          this.p[i] = op[i];

  /*  Start the algorithm for one zero. */
  _40:     
  for (;;) {   

    // console.info('40 loop');

      if (this.n == 1) {
          zeror[degree-1] = -this.p[1]/this.p[0];
          zeroi[degree-1] = 0.0;
          this.n -= 1;

          // goto _99;
          return degree - this.n;

      }

  /*  Calculate the final zero or pair of zeros. */
      if (this.n == 2) {
          const out = { sr: zeror[degree-2], si: zeroi[degree-2], lr: zeror[degree-1], li: zeroi[degree-1]}
          // this.quad(this.p[0], this.p[1], this.p[2], zeror[degree-2], zeroi[degree-2], zeror[degree-1],zeroi[degree-1]);
          this.quad(this.p[0], this.p[1], this.p[2], out);
          zeror[degree-2] = out.sr;
          zeroi[degree-2] = out.si;
          zeror[degree-1] = out.lr;
          zeroi[degree-1] = out.li;

          this.n -= 2;
          // goto _99;
          return degree - this.n;
      }

  /*  Find largest and smallest moduli of coefficients. */
      max = 0.0;
      min = infin;
      for (i=0;i<=this.n;i++) {
          x = Math.abs(this.p[i]);
          if (x > max) max = x;
          if (x != 0.0 && x < min) min = x;
      }
      
  /*  Scale if there are large or very small coefficients.
   *  Computes a scale factor to multiply the coefficients of the
   *  polynomial. The scaling si done to avoid overflow and to
   *  avoid undetected underflow interfering with the convergence
   *  criterion. The factor is a power of the base.
   */

  switch (true) {
  case true:
      sc = lo/min;
      if (sc > 1.0 && infin/sc < max) break; // goto _110;
      if (sc <= 1.0) {
          if (max < 10.0) break; // goto _110;
          if (sc == 0.0)
              sc = smalno;
      }
      l = Math.floor(Math.log(sc)/Math.log(base) + 0.5);
      factor = (Math.pow( base, l )); // extraneous cast required by VS 16.8.2
      if (factor != 1.0) {
          for (i=0;i<=this.n;i++) 
              this.p[i] = factor*this.p[i];     /* Scale polynomial. */
      }

  }

  _110:

  /*  Compute lower bound on moduli of roots. */
      for (i=0;i<=this.n;i++) {
          pt[i] = (Math.abs(this.p[i]));
      }
      pt[this.n] = - pt[this.n];
  /*  Compute upper estimate of bound. */
      x = Math.exp((Math.log(-pt[this.n])-Math.log(pt[0])) / this.n);
  /*  If Newton step at the origin is better, use it. */        
      if (pt[this.n-1] != 0.0) {
          xm = -pt[this.n]/pt[this.n-1];
          if (xm < x)  x = xm;
      }
  /*  Chop the interval (0,x) until ff <= 0 */
    //console.info('in', pt);
      for (;;) { //while (1) {
          xm = x*0.1;
          ff = pt[0];
          for (i=1;i<=this.n;i++) 
              ff = ff*xm + pt[i];
          if (ff <= 0.0) break;
          // else console.info(ff);
          x = xm;
      }
      // console.info('out');

      dx = x;
  /*  Do Newton interation until x converges to two 
   *  decimal places. 
   */
      while (Math.abs(dx/x) > 0.005) {
          ff = pt[0];
          df = ff;
          for (i=1;i<this.n;i++) { 
              ff = ff*x + pt[i];
              df = df*x + ff;
          }
          ff = ff*x + pt[this.n];
          dx = ff/df;
          x -= dx;
      }
      bnd = x;
  /*  Compute the derivative as the initial k polynomial
   *  and do 5 steps with no shift.
   */
      nm1 = this.n - 1;
      for (i=1;i<this.n;i++)
        this.k[i] = (this.n-i)*this.p[i]/this.n;
      this.k[0] = this.p[0];
      aa = this.p[this.n];
      bb = this.p[this.n-1];
      zerok = (this.k[this.n-1] === 0);
      for(jj=0;jj<5;jj++) {
          cc = this.k[this.n-1];
          if (!zerok) {
  /*  Use a scaled form of recurrence if value of k at 0 is nonzero. */             
              t = -aa/cc;
              for (i=0;i<nm1;i++) {
                  j = this.n-i-1;
                  this.k[j] = t*this.k[j-1]+this.p[j];
              }
              this.k[0] = this.p[0];
              zerok = (Math.abs(this.k[this.n-1]) <= Math.abs(bb)*this.eta*10.0);
          }
          else {
  /*  Use unscaled form of recurrence. */
              for (i=0;i<nm1;i++) {
                  j = this.n-i-1;
                  this.k[j] = this.k[j-1];
              }
              this.k[0] = 0.0;
              zerok = (this.k[this.n-1] === 0.0);
          }
      }
  /*  Save k for restarts with new shifts. */
      for (i=0;i<this.n;i++) 
          temp[i] = this.k[i];
  /*  Loop to select the quadratic corresponding to each new shift. */
      for (cnt = 0;cnt < 20;cnt++) {
  /*  Quadratic corresponds to a double shift to a            
   *  non-real point and its complex conjugate. The point
   *  has modulus bnd and amplitude rotated by 94 degrees
   *  from the previous shift.
   */ 
          xxx = cosr*xx - sinr*yy;
          yy = sinr*xx + cosr*yy;
          xx = xxx;
          this.sr = bnd*xx;
          this.si = bnd*yy;
          this.u = -2.0 * this.sr;
          this.v = bnd;

          // fxshfr(20*(cnt+1),&nz);
          {
            const out = { nz };
            this.fxshfr(20*(cnt+1), out);
            nz = out.nz;
          }

          if (nz != 0) {
  /*  The second stage jumps directly to one of the third
   *  stage iterations and returns here if successful.
   *  Deflate the polynomial, store the zero or zeros and
   *  return to the main algorithm.
   */
              j = degree - this.n;
              zeror[j] = this.szr;
              zeroi[j] = this.szi;
              this.n -= nz;
              for (i=0;i<=this.n;i++)
              this.p[i] = this.qp[i];
              if (nz != 1) {
                  zeror[j+1] = this.lzr;
                  zeroi[j+1] = this.lzi;
              }
              continue _40; // goto _40;
              
          }
  /*  If the iteration is unsuccessful another quadratic
   *  is chosen after restoring k.
   */
          for (i=0;i<this.n;i++) {
            this.k[i] = temp[i];
          }
      } 
  /*  Return with failure if no convergence with 20 shifts. */
  _99:

      /*
      delete [] svk;
      delete [] qk;
      delete [] k;
      delete [] qp;
      delete [] p;
      delete [] pt;
      delete [] temp;
      */

      return degree - this.n;
    }
  } 

/*  Calculate the zeros of the quadratic a*z^2 + b1*z + c.
 *  The quadratic formula, modified to avoid overflow, is used 
 *  to find the larger zero if the zeros are real and both
 *  are complex. The smaller real zero is found directly from 
 *  the product of the zeros c/a.
 */
public quad(a: number, b1: number, c: number, out: { sr: number, si: number, lr: number, li: number}) {

  let b = 0;
        let d = 0;
        let e = 0;

        if (a == 0.0) {         /* less than two roots */
            if (b1 != 0.0)     
                out.sr = -c/b1;
            else 
                out.sr = 0.0;
            out.lr = 0.0;
            out.si = 0.0;
            out.li = 0.0;
            return;
        }
        if (c == 0.0) {         /* one real root, one zero root */
            out.sr = 0.0;
            out.lr = -b1/a;
            out.si = 0.0;
            out.li = 0.0;
            return;
        }

/* Compute discriminant avoiding overflow. */
        b = b1/ 2.0;
        if (Math.abs(b) < Math.abs(c)) { 
            if (c < 0.0) 
                e = -a;
            else
                e = a;
            e = b*(b/Math.abs(c)) - e;
            d = Math.sqrt(Math.abs(e))*Math.sqrt(Math.abs(c));
        }
        else {
            e = 1.0 - (a/b)*(c/b);
            d = Math.sqrt(Math.abs(e))*Math.abs(b);
        }
        if (e < 0.0) {      /* complex conjugate zeros */
          out.sr = -b/a;
          out.lr = out.sr;
          out.si = Math.abs(d/a);
          out.li = -(out.si);
        }
        else {
            if (b >= 0.0)   /* real zeros. */
                d = -d;
                out.lr = (-b+d)/a;
                out.sr = 0.0;
                if (out.lr != 0.0) 
                  out.sr = (c/ out.lr)/a;
                out.si = 0.0;
                out.li = 0.0;
        }
}

public fxshfr(l2: number, out: {nz: number}){

    let svu = 0, svv = 0, ui = 0, vi = 0, s = 0;
    let betas = 0, betav = 0, oss = 0, ovv = 0, ss = 0, vv = 0, ts = 0, tv = 0;
    let ots = 0, otv = 0, tvv = 0, tss = 0;
    
    let type = 0, i = 0, j = 0, iflag = 0, vpass = false, spass = false, vtry = 0, stry = 0;

    out.nz = 0;
    betav = 0.25;
    betas = 0.25;
    oss = this.sr;
    ovv = this.v;
/*  Evaluate polynomial by synthetic division. */
    
    //quadsd(n,&u,&v,p,qp,&a,&b);
    {
      const out = {
        u: this.u,
        v: this.v,
        a: this.a,
        b: this.b,
      };
      this.quadsd_(this.n, this.p, this.qp, out);
      this.u = out.u;
      this.v = out.v;
      this.a = out.a;
      this.b = out.b;
    }

    type = this.calcsc_(type);

    for (j=0;j<l2;j++) {
/*  Calculate next k polynomial and estimate v. */
        type = this.nextk_(type);
        type = this.calcsc_(type);

        // newest(type,&ui,&vi);
        {
          const out = { uu: ui, vv: vi };
          this.newest(type, out);
          ui = out.uu;
          vi = out.vv;
        }

        vv = vi;
/*  Estimate s. */
        ss = 0.0;
        if (this.k[this.n-1] != 0.0) ss = -this.p[this.n]/this.k[this.n-1];
        tv = 1.0;
        ts = 1.0;

      // this is a switch for label _70, we have 2 gotos
      switch (true) {
      case true: {

        if (j == 0 || type == 3) break; // goto _70;
/*  Compute relative measures of convergence of s and v sequences. */
        if (vv != 0.0) tv = Math.abs((vv-ovv)/vv);
        if (ss != 0.0) ts = Math.abs((ss-oss)/ss);
/*  If decreasing, multiply two most recent convergence measures. */
        tvv = 1.0;
        if (tv < otv) tvv = tv*otv;
        tss = 1.0;
        if (ts < ots) tss = ts*ots;
/*  Compare with convergence criteria. */
        vpass = (tvv < betav);
        spass = (tss < betas);
        if (!(spass || vpass)) break; // goto _70;
/*  At least one sequence has passed the convergence test.
 *  Store variables before iterating.
 */
        svu = this.u;
        svv = this.v;
        for (i=0;i<this.n;i++) {
          this.svk[i] = this.k[i];
        }
        s = ss;
/*  Choose iteration according to the fastest converging
 *  sequence.
 */
        vtry = 0;
        stry = 0;

        // this is the hardest goto to fix. it jumps into what is now the 
        // loop below -- that loop patches a different goto. and it jumps into
        // what is now a switch, to patch another goto

        let skip40 = false;

        if ( ( spass && (!vpass) ) || tss < tvv) skip40 = true; // goto _40;

_20:        
    // this is a loop for label _20
    for (;;) {

      if (!skip40) {

        // quadit(&ui,&vi,nz);
        {
          const out2 = {
            uu: ui,
            vv: vi,
            nz: out.nz,
          };
          this.quadit(out2);
          ui = out2.uu;
          vi = out2.vv;
          out.nz = out2.nz;
        }

        if (out.nz > 0) return;
/*  Quadratic iteration has failed. Flag that it has
 *  been tried and decrease the convergence criterion.
 */
        vtry = 1;
        betav *= 0.25;

      }

/*  Try linear iteration if it has not been tried and
 *  the S sequence is converging.
 */

        // this is a switch for label _50, we have 2 gotos
        switch (true) {
        case true:

        if (!skip40) {

          if (stry || !spass) break; // goto _50;
          for (i=0;i<this.n;i++) {
            this.k[i] = this.svk[i];
          }

        }
        skip40 = false;

_40:
        // realit(&s,nz,&iflag);
        // eslint-disable-next-line @typescript-eslint/brace-style
        {
          const out2 = {
            sss: s,
            nz: out.nz,
            iflag,
          };
          this.realit(out2);
          s = out2.sss;
          out.nz = out2.nz;
          iflag = out2.iflag;
        }

        if (out.nz > 0) return;
/*  Linear iteration has failed. Flag that it has been
 *  tried and decrease the convergence criterion.
 */
        stry = 1;
        betas *=0.25;
        if (iflag == 0) break; // goto _50;
/*  If linear iteration signals an almost double real
 *  zero attempt quadratic iteration.
 */
        ui = -(s+s);
        vi = s*s;
        continue _20; //goto _20;

      }

/*  Restore variables. */
_50:
        this.u = svu;
        this.v = svv;
        for (i=0;i<this.n;i++) {
          this.k[i] = this.svk[i];
        }
/*  Try quadratic iteration if it has not been tried
 *  and the V sequence is convergin.
 */
        if (vpass && !vtry) continue _20; // goto _20;


        // end the loop for label _20
        break;
      }

/*  Recompute QP and scalar values to continue the
 *  second stage.
 */
      // quadsd(n,&u,&v,p,qp,&a,&b);
      // quadsd(n,&u,&v,p,qp,&a,&b);
      {
        const out = {
          u: this.u,
          v: this.v,
          a: this.a,
          b: this.b,
        };
        this.quadsd_(this.n, this.p, this.qp, out);
        this.u = out.u;
        this.v = out.v;
        this.a = out.a;
        this.b = out.b;
      }

        type = this.calcsc_(type);

    }
  }

_70:
        ovv = vv;
        oss = ss;
        otv = tv;
        ots = ts;
    }
}

/*  Variable-shift k-polynomial iteration for a
 *  quadratic factor converges only if the zeros are
 *  equimodular or nearly so.
 *  uu, vv - coefficients of starting quadratic.
 *  nz - number of zeros found.
 */
public quadit(out: {uu: number, vv: number, nz: number}){
    let ui = 0, vi = 0;
    let mp = 0, omp = 0, ee = 0, relstp = 0, t = 0, zm = 0;
    let type = 0, i = 0, j = 0, tried = 0;

    out.nz = 0;
    tried = 0;
    this.u = out.uu;
    this.v = out.vv;
    j = 0;
/*  Main loop. */
_10:    

  for (;;) {

    // quad(1.0, u, v, &szr, &szi, &lzr, &lzi);
    {
      const out = {
        sr: this.szr, si: this.szi,
        lr: this.lzr, li: this.lzi,
      };
      this.quad(1.0, this.u, this.v, out);
      this.szr = out.sr;
      this.szi = out.si;
      this.lzr = out.lr;
      this.lzi = out.li;
    }


/*  Return if roots of the quadratic are real and not
 *  close to multiple or nearly equal and of opposite
 *  sign.
 */

// sherm 20130410: this early return caused premature termination and 
// then failure to find any roots in rare circumstances with 6th order
// ellipsoid nearest point equations. Previously (and in all implementations of
// Jenkins-Traub that I could find) it was just a test on the
// relative size of the difference with respect to the larger root lzr.
// I added the std::max(...,0.1) so that if the roots are small then an
// absolute difference below 0.001 will be considered "close enough" to 
// continue iterating. In the case that failed, the roots were around .0001
// and .0002, so their difference was considered large compared with 1% of 
// the larger root, 2e-6. But in fact continuing the loop instead resulted in
// six very high-quality roots instead of none.
//
// I'm sorry to say I don't know if I have correctly diagnosed the problem or
// whether this is the right fix! It does pass the regression tests and 
// apparently cured the ellipsoid problem. I added the particular bad
// polynomial to the PolynomialTest regression if you want to see it fail.
// These are the problematic coefficients:
//   1.0000000000000000
//   0.021700000000000004
//   2.9889970904696875e-005
//   1.0901272298136685e-008
//  -4.4822782160985054e-012
//  -2.6193432740351220e-015
//  -3.0900602527225053e-019
//
// Original code:
    //if (fabs(fabs(szr)-fabs(lzr)) > 0.01 * fabs(lzr)) return;
// Fixed version:
    if (Math.abs(Math.abs(this.szr)-Math.abs(this.lzr)) > 0.01 * Math.max(Math.abs(this.lzr),0.1)) 
        return;

/*  Evaluate polynomial by quadratic synthetic division. */
    // quadsd(n,&u,&v,p,qp,&a,&b);
    {
      // NOTE: we could just pass this here

      const out = { u: this.u, v: this.v, a: this.a, b: this.b };
      this.quadsd_(this.n, this.p, this.qp, out);
      this.u = out.u;
      this.v = out.v;
      this.a = out.a;
      this.b = out.b;
    }

    mp = Math.abs(this.a-this.szr*this.b) + Math.abs(this.szi*this.b);
/*  Compute a rigorous bound on the rounding error in
 *  evaluating p.
 */
    zm = Math.sqrt(Math.abs(this.v));
    ee =  2.0*Math.abs(this.qp[0]);
    t = -this.szr*this.b;
    for (i=1;i<this.n;i++) {
        ee = ee*zm + Math.abs(this.qp[i]);
    }
    ee = ee*zm + Math.abs(this.a+t);
    ee *= (5.0 *this.mre + 4.0*this.are);
       ee = ee - (5.0*this.mre+2.0*this.are)*(Math.abs(this.a+t)+Math.abs(this.b)*zm)+2.0*this.are*Math.abs(t);
/*  Iteration has converged sufficiently if the
 *  polynomial value is less than 20 times this bound.
 */
    if (mp <= 20.0*ee) {
        out.nz = 2;
        return;
    }
    j++;
/*  Stop iteration after 20 steps. */
    if (j > 20) return;

  switch(true) {
    case true:

    if (j < 2) break; // goto _50;
    if (relstp > 0.01 || mp < omp || tried) break; // goto _50;
/*  A cluster appears to be stalling the convergence.
 *  Five fixed shift steps are taken with a u,v close
 *  to the cluster.
 */
    if (relstp < this.eta) relstp = this.eta;
    relstp = Math.sqrt(relstp);
    this.u = this.u - this.u*relstp;
    this.v = this.v + this.v*relstp;

    // quadsd(n,&u,&v,p,qp,&a,&b);
    // quadsd(n,&u,&v,p,qp,&a,&b);
    {
      // NOTE: we could just pass this here

      const out = { u: this.u, v: this.v, a: this.a, b: this.b };
      this.quadsd_(this.n, this.p, this.qp, out);
      this.u = out.u;
      this.v = out.v;
      this.a = out.a;
      this.b = out.b;
    }
      
    for (i=0;i<5;i++) {
        type = this.calcsc_(type);
        type = this.nextk_(type);
    }
    tried = 1;
    j = 0;

  }

_50:
    omp = mp;
/*  Calculate next k polynomial and new u and v. */
    type = this.calcsc_(type);
    type = this.nextk_(type);
    type = this.calcsc_(type);

    // newest(type,&ui,&vi);
    {
      const out = { uu: ui, vv: vi };
      this.newest(type, out);
      ui = out.uu;
      vi = out.vv;
    }

/*  If vi is zero the iteration is not converging. */
    if (vi == 0.0) return;
    relstp = Math.abs((vi-this.v)/vi);
    this.u = ui;
    this.v = vi;


  } //  goto _10;

}

/*  Variable-shift H polynomial iteration for a real zero.
 *  sss - starting iterate
 *  nz  - number of zeros found
 *  iflag - flag to indicate a pair of zeros near real axis.
 */
public realit(out: {sss: number, nz: number, iflag: number}){
    let pv = 0, kv = 0, t = 0, s = 0;
    let ms = 0, mp = 0, omp = 0, ee = 0;
    let i = 0, j = 0;

    out.nz = 0;
    s = out.sss;
    out.iflag = 0;
    j = 0;
/*  Main loop */
    for (;;) { // while (1) {
        pv = this.p[0];
/*  Evaluate p at s. */
        this.qp[0] = pv;
        for (i=1;i<=this.n;i++) {
            pv = pv*s + this.p[i];
            this.qp[i] = pv;
        }
        mp = Math.abs(pv);
/*  Compute a rigorous bound on the error in evaluating p. */
        ms = Math.abs(s);
        ee = (this.mre/(this.are+this.mre))*Math.abs(this.qp[0]);
        for (i=1;i<=this.n;i++) {
            ee = ee*ms + Math.abs(this.qp[i]);
        }
/*  Iteration has converged sufficiently if the polynomial
 *  value is less than 20 times this bound.
 */
        if (mp <= 20.0*((this.are+this.mre)*ee-this.mre*mp)) {
            out.nz = 1;
            this.szr = s;
            this.szi = 0.0;
            return;
        }
        j++;
/*  Stop iteration after 10 steps. */
        if (j > 10) return;

      switch (true) {
        case true:

        if (j < 2) break; // goto _50;
        if (Math.abs(t) > 0.001*Math.abs(s-t) || mp < omp) break; // goto _50;
/*  A cluster of zeros near the real axis has been
 *  encountered. Return with iflag set to initiate a
 *  quadratic iteration.
 */
        out.iflag = 1;
        out.sss = s;
        return;
      }

/*  Return if the polynomial value has increased significantly. */
_50:
        omp = mp;
/*  Compute t, the next polynomial, and the new iterate. */
        kv = this.k[0];
        this.qk[0] = kv;
        for (i=1;i<this.n;i++) {
            kv = kv*s + this.k[i];
            this.qk[i] = kv;
        }
        if (Math.abs(kv) <= Math.abs(this.k[this.n-1])*10.0*this.eta) {
/*  Use unscaled form. */
            this.k[0] = 0.0;
            for (i=1;i<this.n;i++) {
              this.k[i] = this.qk[i-1];
            }
        }
        else {
/*  Use the scaled form of the recurrence if the value
 *  of k at s is nonzero.
 */
            t = -pv/kv;
            this.k[0] = this.qp[0];
            for (i=1;i<this.n;i++) {
              this.k[i] = t*this.qk[i-1] + this.qp[i];
            }
        }
        kv = this.k[0];
        for (i=1;i<this.n;i++) {
            kv = kv*s + this.k[i];
        }
        t = 0.0;
        if (Math.abs(kv) > Math.abs(this.k[this.n-1]*10.0*this.eta)) t = -pv/kv;
        s += t;
    }
}

/*  This routine calculates scalar quantities used to
 *  compute the next k polynomial and new estimates of
 *  the quadratic coefficients.
 *  type - integer variable set here indicating how the
 *  calculations are normalized to avoid overflow.
 * 
 * NOTE: changed parameter, added return type
 */
public calcsc_(type: number): number {

  /*  Synthetic division of k by the quadratic 1,u,v */    
    // quadsd(n-1,&u,&v,k,qk,&c,&d);

  const out2 = {
    u: this.u,
    v: this.v,
    a: this.c,
    b: this.d,
  };

  this.quadsd_(this.n -1, this.k, this.qk, out2);
  this.u = out2.u;
  this.v = out2.v;
  this.c = out2.a;
  this.d = out2.b;

  switch(true) {
    case true:

    if (Math.abs(this.c) > Math.abs(this.k[this.n-1]*100.0*this.eta)) break; // goto _10;
    if (Math.abs(this.d) > Math.abs(this.k[this.n-2]*100.0*this.eta)) break; // goto _10;
    type = 3;
/*  Type=3 indicates the quadratic is almost a factor of k. */
    return type;

  }

_10:
    if (Math.abs(this.d) < Math.abs(this.c)) {
        type = 1;
/*  Type=1 indicates that all formulas are divided by c. */   
        this.e = this.a/this.c;
        this.f = this.d/this.c;
        this.g = this.u*this.e;
        this.h = this.v*this.b;
        this.a3 = this.a*this.e + (this.h/this.c+this.g)*this.b;
        this.a1 = this.b - this.a*(this.d/this.c);
        this.a7 = this.a + this.g*this.d + this.h*this.f;
        return type;
    }
    type = 2;

/*  Type=2 indicates that all formulas are divided by d. */
    this.e = this.a/this.d;
    this.f = this.c/this.d;
    this.g = this.u*this.b;
    this.h = this.v*this.b;
    this.a3 = (this.a+this.g)*this.e + this.h*(this.b/this.d);
    this.a1 = this.b*this.f-this.a;
    this.a7 = (this.f+this.u)*this.a + this.h;

    return type;
}

/*  Computes the next k polynomials using scalars 
 *  computed in calcsc.
 *
 * NOTE: changed parameters, returns the new value
 * NOTE: this function doesn't actually change the value, we could drop the return value
 */
public nextk_(type: number): number {
    let temp = 0;
    let i = 0;

    if (type === 3) {
/*  Use unscaled form of the recurrence if type is 3. */
        this.k[0] = 0.0;
        this.k[1] = 0.0;
        for (i=2;i<this.n;i++) {
          this.k[i] = this.qk[i-2];
        }
        return type;
    }
    temp = this.a;
    if (type === 1) temp = this.b;
    if (Math.abs(this.a1) <= Math.abs(temp)*this.eta*10.0) {
/*  If a1 is nearly zero then use a special form of the
 *  recurrence.
 */
        this.k[0] = 0.0;
        this.k[1] = -this.a7*this.qp[0];
        for(i=2;i<this.n;i++) {
          this.k[i] = this.a3*this.qk[i-2] - this.a7*this.qp[i-1];
        }
        return type;
    }
/*  Use scaled form of the recurrence. */
    this.a7 /= this.a1;
    this.a3 /= this.a1;
    this.k[0] = this.qp[0];
    this.k[1] = this.qp[1] - this.a7*this.qp[0];
    for (i=2;i<this.n;i++) {
      this.k[i] = this.a3*this.qk[i-2] - this.a7*this.qp[i-1] + this.qp[i];
    }

    return type;
}

/*  Compute new estimates of the quadratic coefficients
 *  using the scalars computed in calcsc.
 */
  public newest(type: number, out: { uu: number, vv: number})   {
    let a4 = 0, a5 = 0, b1 = 0, b2 = 0, c1 = 0, c2 = 0, c3 = 0, c4 = 0, temp = 0;
  
  /* Use formulas appropriate to setting of type. */
      if (type == 3) {
  /*  If type=3 the quadratic is zeroed. */
          out.uu = 0.0;
          out.vv = 0.0;
          return;
      }
      if (type == 2) {
          a4 = (this.a+this.g)*this.f + this.h;
          a5 = (this.f+this.u)*this.c + this.v*this.d;
      }
      else {
          a4 = this.a + this.u*this.b +this.h*this.f;
          a5 = this.c + (this.u+this.v*this.f)*this.d;
      }
  /*  Evaluate new quadratic coefficients. */
      b1 = -this.k[this.n-1]/this.p[this.n];
      b2 = -(this.k[this.n-2]+b1*this.p[this.n-1])/this.p[this.n];
      c1 = this.v*b2*this.a1;
      c2 = b1*this.a7;
      c3 = b1*b1*this.a3;
      c4 = c1 - c2 - c3;
      temp = a5 + b1*a4 - c4;
      if (temp == 0.0) {
          out.uu = 0.0;
          out.vv = 0.0;
          return;
      }
      out.uu = this.u - (this.u*(c3+c2)+this.v*(b1*this.a1+b2*this.a7))/temp;
      out.vv = this.v*(1.0+c4/temp);
      return;
  }

  
/*  Divides p by the quadratic 1,u,v placing the quotient
 *  in q and the remainder in a,b.
 *
  * NOTE: reordered parameters (_ is intended to force you to update the call) 
  */
  public quadsd_(nn: number, p: number[], q: number[], out: { u: number, v: number, a: number, b: number}) {

    let c = 0;
    let i = 0;

    out.b = p[0];

    q[0] = out.b;
    out.a = p[1] - (out.b)*(out.u);
    q[1] = out.a;

    for (i=2;i<=nn;i++) {
        c = p[i] - (out.a)*(out.u) - (out.b)*(out.v);
        q[i] = c;
        out.b = out.a;
        out.a = c;
    }
  }

}
