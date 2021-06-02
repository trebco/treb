
## Complex Number Support

TREB supports complex numbers as an intrinsic type, that is, you can use them anywhere you would use a real number. You can type them in cells and use them as arguments to functions.

Complex number support is very much a work in progress. If you have questions, comments, or feature requests, please [let us know][1].

## Parsing

When entering a complex number, you must use the token `i` (lower-case ASCII "i", unicode U+0069) for the imaginary component. The token `i` on its own implies a value of `1i`. The magnitude must precede the token, for example `3i` or `1.2i`.

## Rendering and Formatting

When displaying complex numbers, TREB uses an italic character `𝑖` (mathematical italic small i, unicode U+1D456). We believe this character is available in the default fonts on all platforms we support. If necessary, you can change this character using a run-time option.

Generally speaking we try to render complex numbers in the simplest possible way.

If a complex value has no imaginary value (or if it would render as `0` in the current number format), when displaying the value we will omit the imaginary component. The same goes for the real component, if there is an imaginary component. So complex numbers may render as

+ `3.2`
+ `2𝑖`
+ `0.00`

Number formatting is not well-defined for complex numbers. At the moment, we use the currently selected number format and apply it to both the real and imaginary components. 

We recommend that you use only basic number formats like "General" or "Number". Fractional number formats also work well. Increasing or decreasing the decimal (or fractional) precision works as expected. 


## Functions and Operators

The following functions and operators support complex numbers:

### Unary operators

+ \- (negation)

### Binary operators

+ \+ (addition)
+ \- (subtraction)
+ / (division)
+ \* (multiplication)
+ ^ (exponentiation) (see note)

### Equalities

+ == (equality)
+ <> (inequality)

### Functions

Functions specifically written for complex numbers

+ ComplexLog - the complex Log function
+ Arg - returns the principal argument of a complex number
+ Real - returns the real component of a complex number
+ Imaginary - returns the magnitude of the imaginary component of a complex number
+ Conjugate - returns the complex conjugate
+ Complex - promotes real values to the complex domain (see note)

Functions updated to support complex arguments 

+ Exp
+ Abs
+ Sum
+ MMult
+ MInverse
+ MDeterm
+ Power (see note)
+ Sqrt (see note)

<br/>  

---

<br/>  

Note: The `SQRT` function return NaN for some operations on real values, like `SQRT(-1)`. The same is true for the `POWER` function and the exponentiation operator `^`.

We don't want to change existing behavior, so we are leaving this as-is for real values. If the argument to `SQRT` is complex, e.g. `SQRT(-1 + 0i)` it will return the complex result `i`. If the argument is real, however, `SQRT(-1)` will return NaN.

Our aim here is twofold: first, we do not want to change existing behavior or expectations. Second, we do not want functions to accidentally introduce complex numbers into models that expect real values only.

This presents a problem for values returned from functions which may be in either real or complex domain. To resolve this, and create a pattern for consistent behavior, we provide the function `COMPLEX`. This function coerces real values to the complex domain.

+ `=SQRT(-1)` returns `NaN`
+ `=SQRT(-1 + 0i)` returns `i`
+ `=SQRT(COMPLEX(-1)` returns `i`

The function `REAL` can be used for the converse, i.e. ensuring a number is treated as real, although this may lose information if a number has an imaginary compnent. 

[1]: https://treb.app/contact.html







