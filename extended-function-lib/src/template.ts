
import { Box, type UnionValue } from 'treb-base-types';
import { AddExtendedFunction } from 'treb-calculator';
import { ArgumentError } from 'treb-calculator';

AddExtendedFunction('TEST1', {

  arguments: [{
    name: 'type',
    description: 'type of value to return'
  }],

  fn: (t?: number): UnionValue => {

    switch (t) {
      case 1:
        return Box(true);

      case 2: 
        return Box(100);

      case 3:
        return Box('string');

      default:

        // this is an error
        return ArgumentError();

    }
    
  },

});


