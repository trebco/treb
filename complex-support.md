
## Complex Number Support

Current functions and operators that support complex arguments. If any function supports complex arguments you can mix complex and real arguments. Return value may be complex or real.

### Unary operators

+ \- (negation)

### Binary operators

+ \+ (addition)
+ \- (subtraction)
+ / (division)
+ \* (multiplication)
+ ^ (exponentiation)

### Equalities

+ == (equality)
+ <> (inequality)

### Functions

Functions specifically written for complex numbers

+ ComplexLog
+ Arg
+ Real
+ Imaginary
+ Conjugate
+ Complex (see note)

Functions updated to support complex arguments 

+ Exp
+ Abs
+ Sum
+ MMult
+ MInverse
+ MDeterm
+ Power (see note)
+ Sqrt (see note)

---

Note: The `SQRT` and `POWER` functions return NaN for some invalid operations on real values, like `SQRT(-1)` or the equivalent `POWER(-1, .5)`. 

We don't necessarily want to change existing behavior, so we are leaving this as-is for real values. If the argument to `SQRT` is complex, e.g. `SQRT(-1 + 0i)` it will return the complex result `i`.

This is a problem, however, for values returned from functions which may be in either the real or the complex plane. To resolve this, and create a pattern for consistent behavior, we provide the function `COMPLEX`. This function coerces real values to the complex plane.

+ `=SQRT(-1)` returns `NaN`
+ `=SQRT(-1 + 0i)` returns `i`
+ `=SQRT(COMPLEX(-1)` returns `i`

The function `REAL` can be used for the converse, i.e. ensuring a number is treated as real, although this may lose information if a number has an imaginary compnent. 









