
treb-mc
=======

treb-mc is an extension of calculator that includes all the MC simulation
functions, random distributions, and everything related to MC. it should now
be possible to build a full working system on either Calculator or MCCalculator,
with the latter having the simulation/MC functions.

design/implementation
---------------------

the aim here is to overload as little as possible. we do have to overload some
things, though, in particular

 + `Calculator.Reset` adds code for clearing simulation results data

 + `ExpressionCalculator.CallExpression` adds code for initializing simulation
   and collecting data during a simulation

We also have overloaded types for `ArgumentDescriptor` and `FunctionDescriptor`,
although these extend the base types so (as long as we don't use the same names)
they should be pretty clean.

We also do some additional initialization in the constructors, after calling
superclass constructors.

todo/roadmap
------------

I'd like the separation to be a little stronger, and reuse more code
(particularly) in `CallExpression`, although that may not be feasible.



